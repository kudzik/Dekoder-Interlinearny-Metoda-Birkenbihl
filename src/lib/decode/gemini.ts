import {
  DecodedDocumentSchema,
  type DecodedDocument,
  type SourceBlock,
} from "./schema";

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    blocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            enum: ["heading", "paragraph", "list-item"],
          },
          level: { type: "INTEGER" },
          sentences: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                natural_pl: { type: "STRING" },
                tokens: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      en: { type: "STRING" },
                      pl_literal: { type: "STRING" },
                      grammar: { type: "STRING" },
                      is_chunk: { type: "BOOLEAN" },
                    },
                    required: ["en", "pl_literal", "grammar", "is_chunk"],
                  },
                },
              },
              required: ["id", "natural_pl", "tokens"],
            },
          },
        },
        required: ["type", "sentences"],
      },
    },
  },
  required: ["blocks"],
} as const;

export class DecodeServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DecodeServiceError";
  }
}

interface GeminiEnvironment {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

const MAX_GEMINI_ATTEMPTS = 3;

function isRetryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

async function waitBeforeRetry(attempt: number, retryAfter: string | null): Promise<void> {
  const retryAfterSeconds = Number(retryAfter);
  const delay =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds * 1_000, 8_000)
      : 500 * 2 ** attempt + Math.floor(Math.random() * 250);
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

function normalizeWords(text: string): string[] {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).map((word) =>
    word.toLocaleLowerCase("en"),
  );
}

function assertMatchesSource(source: SourceBlock[], result: DecodedDocument): void {
  if (source.length !== result.blocks.length) {
    throw new DecodeServiceError("Model zmienił liczbę bloków tekstu. Spróbuj ponownie.", 502);
  }

  source.forEach((sourceBlock, blockIndex) => {
    const decodedBlock = result.blocks[blockIndex];
    if (
      decodedBlock.type !== sourceBlock.type ||
      decodedBlock.level !== sourceBlock.level ||
      decodedBlock.sentences.length !== sourceBlock.sentences.length
    ) {
      throw new DecodeServiceError("Model zmienił strukturę dokumentu. Spróbuj ponownie.", 502);
    }

    sourceBlock.sentences.forEach((sourceSentence, sentenceIndex) => {
      const decodedSentence = decodedBlock.sentences[sentenceIndex];
      if (decodedSentence.id !== sourceSentence.id) {
        throw new DecodeServiceError("Model zmienił kolejność zdań. Spróbuj ponownie.", 502);
      }

      const decodedWords = normalizeWords(decodedSentence.tokens.map((token) => token.en).join(" "));
      const sourceWords = normalizeWords(sourceSentence.text);
      if (decodedWords.length !== sourceWords.length || decodedWords.some((word, index) => word !== sourceWords[index])) {
        throw new DecodeServiceError("Model pominął lub zmienił słowa źródłowe. Spróbuj ponownie.", 502);
      }
    });
  });
}

export async function decodeWithGemini(
  source: SourceBlock[],
  environment: GeminiEnvironment,
): Promise<DecodedDocument> {
  if (!environment.GEMINI_API_KEY) {
    throw new DecodeServiceError("Usługa dekodowania nie jest skonfigurowana.", 503);
  }

  const model = environment.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: JSON.stringify(source) }],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: [
            "Zdekoduj bloki metodą interlinearną Very Birkenbihl.",
            "Zachowaj kolejność bloków, zdań i wszystkie angielskie znaki oraz słowa.",
            "pl_literal to dosłowne dekodowanie każdego tokenu w angielskim szyku; natural_pl jest jedynym miejscem na gładkie tłumaczenie zdania.",
            "Nie łącz zwykłych słów. Zachowuj osobno rodzajniki, zaimki, czasowniki posiłkowe i przyimki; łącz tylko całe phrasal verbs i idiomy w jeden token is_chunk=true.",
            "Tłumacz rodzajniki według kontekstu: przed rzeczownikiem a/an użyj „jakiś/jakaś/jakieś” odpowiednio do polskiego rzeczownika, nigdy „jeden” ani „pewien”, chyba że chodzi o liczbę lub konkretną osobę.",
            "Uwzględniaj kontekst czasów i aspektów: habitualne would z przeszłości oznacza zwyczaj (np. „zwykło”), a następny czasownik oddaj bezokolicznikiem; nie używaj trybu warunkowego „byłbym”.",
            "Przykład: I am looking forward to the trip. -> I/Ja; am/jestem; looking forward to/patrzący w przód do (is_chunk=true); the/ta; trip/podróż. natural_pl: Nie mogę się doczekać podróży.",
            "Przykład: A child would often put off reading a book. -> A/jakieś; child/dziecko; would/zwykło; often/często; put off/odkładać (is_chunk=true); reading/czytanie; a/jakiejś; book/książki.",
            "Przykład: a piece of cake -> jeden token is_chunk=true z pl_literal „kawałek ciasta”; sens idiomu wyjaśnij naturalnie w natural_pl.",
            "Wypełnij natural_pl naturalnym tłumaczeniem danego zdania po polsku.",
            "Zwróć dokładnie te same id, typy bloków i poziomy nagłówków.",
          ].join("\n"),
        },
      ],
    },
    generationConfig: {
      thinkingConfig: { thinkingLevel: "minimal" },
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  let response: Response | undefined;
  for (let attempt = 0; attempt < MAX_GEMINI_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": environment.GEMINI_API_KEY,
        },
        body: requestBody,
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new DecodeServiceError(
          "Gemini nie odpowiedziało w ciągu 45 sekund. Spróbuj ponownie lub podziel tekst na krótsze części.",
          504,
        );
      }
      if (attempt === MAX_GEMINI_ATTEMPTS - 1) {
        throw new DecodeServiceError("Nie udało się połączyć z Gemini API po kilku próbach.", 502);
      }
      await waitBeforeRetry(attempt, null);
      continue;
    }

    if (response.ok || !isRetryableStatus(response.status) || attempt === MAX_GEMINI_ATTEMPTS - 1) {
      break;
    }
    const retryAfter = response.headers.get("retry-after");
    await response.body?.cancel();
    await waitBeforeRetry(attempt, retryAfter);
  }

  if (!response) {
    throw new DecodeServiceError("Gemini API nie zwróciło odpowiedzi.", 502);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new DecodeServiceError("Limit Gemini API został osiągnięty. Sprawdź limity projektu w Google AI Studio.", 503);
    }
    if (response.status === 401 || response.status === 403) {
      throw new DecodeServiceError("Klucz Gemini jest nieprawidłowy lub nie ma dostępu do Gemini API.", 503);
    }
    if (response.status === 404) {
      throw new DecodeServiceError("Wybrany model Gemini jest niedostępny. Sprawdź ustawienie GEMINI_MODEL.", 503);
    }
    if (response.status === 400) {
      throw new DecodeServiceError("Gemini odrzuciło format żądania lub schemat odpowiedzi.", 502);
    }
    if (isRetryableStatus(response.status)) {
      throw new DecodeServiceError(
        `Gemini API jest chwilowo niedostępne (HTTP ${response.status}) po ${MAX_GEMINI_ATTEMPTS} próbach. Spróbuj ponownie za chwilę.`,
        503,
      );
    }
    throw new DecodeServiceError(`Dostawca AI zwrócił błąd HTTP ${response.status}.`, 502);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new DecodeServiceError("Dostawca AI zwrócił nieprawidłową odpowiedź.", 502);
  }

  const jsonText =
    typeof responseBody === "object" &&
    responseBody !== null &&
    "candidates" in responseBody &&
    Array.isArray(responseBody.candidates) &&
    typeof responseBody.candidates[0] === "object" &&
    responseBody.candidates[0] !== null &&
    "content" in responseBody.candidates[0] &&
    typeof responseBody.candidates[0].content === "object" &&
    responseBody.candidates[0].content !== null &&
    "parts" in responseBody.candidates[0].content &&
    Array.isArray(responseBody.candidates[0].content.parts) &&
    typeof responseBody.candidates[0].content.parts[0] === "object" &&
    responseBody.candidates[0].content.parts[0] !== null &&
    "text" in responseBody.candidates[0].content.parts[0] &&
    typeof responseBody.candidates[0].content.parts[0].text === "string"
      ? responseBody.candidates[0].content.parts[0].text
      : null;

  if (!jsonText) {
    throw new DecodeServiceError("Dostawca AI nie zwrócił dekodowania tekstu.", 502);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch {
    throw new DecodeServiceError("Dostawca AI zwrócił nieprawidłowy format danych.", 502);
  }

  const validation = DecodedDocumentSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new DecodeServiceError("Odpowiedź AI nie spełnia wymaganego kontraktu danych.", 502);
  }

  assertMatchesSource(source, validation.data);
  return validation.data;
}
