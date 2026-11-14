import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeechServiceError, synthesizeSpeech } from "../../src/lib/speech/gemini";

function createWavResponse(): Response {
  const wav = new Uint8Array(44);
  wav.set(new TextEncoder().encode("RIFF"), 0);
  wav.set(new TextEncoder().encode("WAVE"), 8);
  const data = btoa(String.fromCharCode(...wav));
  return new Response(
    JSON.stringify({
      steps: [{ type: "model_output", content: [{ type: "audio", data, mime_type: "audio/wav" }] }],
    }),
    { status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("synthesizeSpeech", () => {
  it("requests speech with the selected accent and returns validated WAV data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createWavResponse());
    vi.stubGlobal("fetch", fetchMock);

    const audio = await synthesizeSpeech("Good morning.", "en-GB", { GEMINI_API_KEY: "test-secret" });

    expect(audio.byteLength).toBe(44);
    expect(String.fromCharCode(...audio.slice(0, 4))).toBe("RIFF");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1beta/interactions"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-goog-api-key": "test-secret" }),
      }),
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.model).toBe("gemini-3.8-flash-tts");
    expect(requestBody.input[0].content[0].text).toBe("Good morning.");
    expect(requestBody.input[0].content[0].annotations[0].style).toContain("British English");
    expect(requestBody.response_format).toEqual({ type: "audio" });
  });

  it("does not call Gemini without a configured key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeSpeech("Hello.", "en-US", {})).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports provider rate limiting and rejects non-WAV output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    await expect(synthesizeSpeech("Hello.", "en-US", { GEMINI_API_KEY: "test-secret" })).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("limit"),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "audio", data: btoa("not wav") }] }] }), {
          status: 200,
        }),
      ),
    );
    await expect(synthesizeSpeech("Hello.", "en-US", { GEMINI_API_KEY: "test-secret" })).rejects.toBeInstanceOf(
      SpeechServiceError,
    );
  });
});
