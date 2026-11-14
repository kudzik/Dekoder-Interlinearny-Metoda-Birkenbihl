import type { SpeechAccent } from "./schema";

const GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
const GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

interface SpeechEnvironment {
  GEMINI_API_KEY?: string;
}

export class SpeechServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SpeechServiceError";
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function findAudioData(response: unknown): string | null {
  const body = getRecord(response);
  const outputAudio = getRecord(body?.output_audio);
  if (typeof outputAudio?.data === "string") return outputAudio.data;

  if (!Array.isArray(body?.steps)) return null;
  for (const step of [...body.steps].reverse()) {
    const stepRecord = getRecord(step);
    if (stepRecord?.type !== "model_output" || !Array.isArray(stepRecord.content)) continue;
    for (const content of [...stepRecord.content].reverse()) {
      const contentRecord = getRecord(content);
      if (contentRecord?.type === "audio" && typeof contentRecord.data === "string") {
        return contentRecord.data;
      }
    }
  }
  return null;
}

function decodeWav(base64Audio: string): Uint8Array {
  let audio: string;
  try {
    audio = atob(base64Audio);
  } catch {
    throw new SpeechServiceError("Gemini TTS zwróciło nieprawidłowe dane audio.", 502);
  }

  const bytes = Uint8Array.from(audio, (character) => character.charCodeAt(0));
  if (
    bytes.length < 44 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WAVE"
  ) {
    throw new SpeechServiceError("Gemini TTS nie zwróciło poprawnego pliku WAV.", 502);
  }
  return bytes;
}

export async function synthesizeSpeech(
  text: string,
  accent: SpeechAccent,
  environment: SpeechEnvironment,
): Promise<Uint8Array> {
  if (!environment.GEMINI_API_KEY) {
    throw new SpeechServiceError("Usługa mowy nie jest skonfigurowana.", 503);
  }

  const style =
    accent === "en-GB"
      ? "Speak the exact English text in a clear, natural British English accent, at a calm learner-friendly pace."
      : "Speak the exact English text in a clear, natural American English accent, at a calm learner-friendly pace.";

  let response: Response;
  try {
    response = await fetch(GEMINI_TTS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": environment.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: GEMINI_TTS_MODEL,
        input: [
          {
            type: "user_input",
            content: [
              {
                type: "text",
                text,
                annotations: [{ type: "speech_metadata", style }],
              },
            ],
          },
        ],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: "Kore" }] },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SpeechServiceError("Synteza mowy przekroczyła limit 45 sekund.", 504);
    }
    throw new SpeechServiceError("Nie udało się połączyć z Gemini TTS.", 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SpeechServiceError("Klucz Gemini nie ma dostępu do syntezy mowy.", 503);
    }
    if (response.status === 404) {
      throw new SpeechServiceError("Model Gemini TTS jest niedostępny dla tego klucza.", 503);
    }
    if (response.status === 429) {
      throw new SpeechServiceError("Osiągnięto limit Gemini TTS. Spróbuj ponownie później.", 503);
    }
    throw new SpeechServiceError(`Gemini TTS zwróciło błąd HTTP ${response.status}.`, 502);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new SpeechServiceError("Gemini TTS zwróciło nieprawidłową odpowiedź.", 502);
  }

  const audioData = findAudioData(responseBody);
  if (!audioData) {
    throw new SpeechServiceError("Gemini TTS nie zwróciło dźwięku.", 502);
  }
  return decodeWav(audioData);
}
