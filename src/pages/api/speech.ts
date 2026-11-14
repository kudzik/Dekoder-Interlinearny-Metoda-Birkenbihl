import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { SpeechServiceError, synthesizeSpeech } from "../../lib/speech/gemini";
import { MAX_SPEECH_TEXT_LENGTH, SpeechRequestSchema } from "../../lib/speech/schema";

export const prerender = false;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: { code: "unsupported_media_type", message: "Oczekiwano danych JSON." } }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: { code: "invalid_json", message: "Nieprawidłowy format JSON." } }, 400);
  }

  const input = SpeechRequestSchema.safeParse(body);
  if (!input.success) {
    const tooLong =
      typeof body === "object" &&
      body !== null &&
      "text" in body &&
      typeof body.text === "string" &&
      body.text.length > MAX_SPEECH_TEXT_LENGTH;
    return jsonResponse(
      {
        error: {
          code: tooLong ? "payload_too_large" : "invalid_input",
          message: tooLong
            ? `Tekst do syntezy może mieć maksymalnie ${MAX_SPEECH_TEXT_LENGTH} znaków.`
            : "Podaj tekst oraz akcent en-GB lub en-US.",
        },
      },
      tooLong ? 413 : 400,
    );
  }

  try {
    const address = request.headers.get("cf-connecting-ip") || "local";
    const { success } = await env.SPEECH_RATE_LIMITER.limit({ key: address });
    if (!success) {
      return jsonResponse(
        { error: { code: "rate_limited", message: "Za dużo żądań mowy. Spróbuj ponownie za minutę." } },
        429,
      );
    }
  } catch {
    return jsonResponse(
      { error: { code: "rate_limiter_error", message: "Usługa mowy jest chwilowo niedostępna." } },
      503,
    );
  }

  try {
    const wav = await synthesizeSpeech(input.data.text, input.data.accent, env);
    const audioBuffer = new ArrayBuffer(wav.byteLength);
    new Uint8Array(audioBuffer).set(wav);
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SpeechServiceError) {
      return jsonResponse({ error: { code: `speech_${error.status}`, message: error.message } }, error.status);
    }

    console.error("Nieoczekiwany błąd syntezy mowy.");
    return jsonResponse(
      { error: { code: "internal_error", message: "Wystąpił nieoczekiwany błąd syntezy mowy." } },
      500,
    );
  }
};
