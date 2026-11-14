import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { DecodeServiceError, decodeWithGemini } from "../../lib/decode/gemini";
import { EmptyMarkdownError, parseMarkdown, UnsupportedMarkdownError } from "../../lib/decode/markdown";
import { DecodeRequestSchema, MAX_MARKDOWN_LENGTH } from "../../lib/decode/schema";

export const prerender = false;
const MAX_REQUEST_BYTES = MAX_MARKDOWN_LENGTH * 4 + 1_024;

class RequestTooLargeError extends Error {}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) throw new SyntaxError("Brak treści żądania.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

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
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return jsonResponse({ error: { code: "unsupported_media_type", message: "Oczekiwano danych JSON." } }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: { code: "payload_too_large", message: "Tekst jest zbyt długi." } }, 413);
  }

  const address = request.headers.get("cf-connecting-ip") || "local";
  try {
    const { success } = await env.DECODE_RATE_LIMITER.limit({ key: address });
    if (!success) {
      return jsonResponse(
        { error: { code: "rate_limited", message: "Za dużo żądań. Spróbuj ponownie za minutę." } },
        429,
      );
    }
  } catch {
    return jsonResponse(
      { error: { code: "rate_limiter_error", message: "Usługa dekodowania jest chwilowo niedostępna." } },
      503,
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonResponse({ error: { code: "payload_too_large", message: "Treść żądania jest zbyt duża." } }, 413);
    }
    return jsonResponse({ error: { code: "invalid_json", message: "Nieprawidłowy format JSON." } }, 400);
  }

  const input = DecodeRequestSchema.safeParse(body);
  if (!input.success) {
    const tooLong =
      typeof body === "object" &&
      body !== null &&
      "markdown" in body &&
      typeof body.markdown === "string" &&
      body.markdown.length > MAX_MARKDOWN_LENGTH;
    return jsonResponse(
      {
        error: {
          code: tooLong ? "payload_too_large" : "invalid_input",
          message: tooLong ? "Tekst może mieć maksymalnie 20 000 znaków." : "Podaj tekst Markdown do dekodowania.",
        },
      },
      tooLong ? 413 : 400,
    );
  }

  try {
    const source = parseMarkdown(input.data.markdown);
    const result = await decodeWithGemini(source, env);
    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof UnsupportedMarkdownError) {
      return jsonResponse({ error: { code: "unsupported_markdown", message: error.message } }, 422);
    }
    if (error instanceof EmptyMarkdownError) {
      return jsonResponse({ error: { code: "empty_document", message: error.message } }, 400);
    }
    if (error instanceof RangeError) {
      return jsonResponse({ error: { code: "document_too_complex", message: error.message } }, 413);
    }
    if (error instanceof DecodeServiceError) {
      return jsonResponse(
        { error: { code: `decode_${error.status}`, message: error.message } },
        error.status,
      );
    }

    console.error("Nieoczekiwany błąd dekodowania.");
    return jsonResponse(
      { error: { code: "internal_error", message: "Wystąpił nieoczekiwany błąd dekodowania." } },
      500,
    );
  }
};
