import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeWithGemini } from "../../src/lib/decode/gemini";
import { parseMarkdown } from "../../src/lib/decode/markdown";

const source = parseMarkdown("I am ready.");
const validModelResult = {
  blocks: [
    {
      type: "paragraph",
      sentences: [
        {
          id: "1-1",
          natural_pl: "Jestem gotowy.",
          tokens: [
            { en: "I", pl_literal: "Ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "am ready.", pl_literal: "jestem gotowy.", grammar: "Czasownik", is_chunk: false },
          ],
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("decodeWithGemini", () => {
  it("uses the server key and returns a source-aligned structured response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validModelResult) }] } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(decodeWithGemini(source, { GEMINI_API_KEY: "test-secret" })).resolves.toEqual(validModelResult);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/models/gemini-4-hydrogen:generateContent"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-goog-api-key": "test-secret" }),
        body: expect.not.stringContaining('"temperature"'),
      }),
    );
  });

  it("retries a temporary Gemini 503 before returning the decoded response", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(validModelResult) }] } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const decode = decodeWithGemini(source, { GEMINI_API_KEY: "test-secret" });
    await vi.advanceTimersByTimeAsync(500);

    await expect(decode).resolves.toEqual(validModelResult);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a response that omits source words", async () => {
    const resultWithMissingWord = structuredClone(validModelResult);
    resultWithMissingWord.blocks[0].sentences[0].tokens.splice(1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(resultWithMissingWord) }] } }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(decodeWithGemini(source, { GEMINI_API_KEY: "test-secret" })).rejects.toMatchObject({
      status: 502,
    });
  });

  it("accepts punctuation differences while preserving source words", async () => {
    const resultWithDifferentPunctuation = structuredClone(validModelResult);
    resultWithDifferentPunctuation.blocks[0].sentences[0].tokens[1].en = "am ready";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(resultWithDifferentPunctuation) }] } }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(decodeWithGemini(source, { GEMINI_API_KEY: "test-secret" })).resolves.toEqual(
      resultWithDifferentPunctuation,
    );
  });

  it("does not call Gemini without a configured key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(decodeWithGemini(source, {})).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
