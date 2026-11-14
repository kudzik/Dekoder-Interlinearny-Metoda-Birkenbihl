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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
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

      const decodedEnglish = decodedSentence.tokens.map((token) => token.en).join(" ");
      if (normalizeWhitespace(decodedEnglish) !== normalizeWhitespace(sourceSentence.text)) {
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

  const model = environment.GEMINI_MODEL || "gemini-2.5-flash";
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": environment.GEMINI_API_KEY,
        },
        body: JSON.stringify({
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
                  "Tłumaczenie pl_literal ma odwzorowywać angielski szyk słowo po słowie.",
                  "Łącz phrasal verbs i idiomy w tokeny is_chunk=true.",
                  "Wypełnij natural_pl naturalnym tłumaczeniem danego zdania po polsku.",
                  "Zwróć dokładnie te same id, typy bloków i poziomy nagłówków.",
                ].join("\n"),
              },
            ],
          },
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
  } catch {
    throw new DecodeServiceError("Nie udało się połączyć z dostawcą AI. Spróbuj ponownie.", 502);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new DecodeServiceError("Limit usługi AI został osiągnięty. Spróbuj ponownie później.", 503);
    }
    throw new DecodeServiceError("Dostawca AI nie zdołał zdekodować tekstu.", 502);
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
