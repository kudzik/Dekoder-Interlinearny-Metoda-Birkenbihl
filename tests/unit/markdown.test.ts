import { describe, expect, it } from "vitest";
import { EmptyMarkdownError, parseMarkdown, UnsupportedMarkdownError } from "../../src/lib/decode/markdown";

describe("parseMarkdown", () => {
  it("keeps heading levels, paragraph sentence boundaries, and list order", () => {
    const blocks = parseMarkdown("# A title\n\nI look forward to spring. She gets up early.\n\n- First task\n- Second task");

    expect(blocks.map(({ type }) => type)).toEqual([
      "heading",
      "paragraph",
      "list-item",
      "list-item",
    ]);
    expect(blocks[0].level).toBe(1);
    expect(blocks[1].sentences.map(({ text }) => text)).toEqual([
      "I look forward to spring.",
      "She gets up early.",
    ]);
    expect(blocks[2].sentences[0].id).toBe("3-1");
    expect(blocks[3].sentences[0].text).toBe("Second task");
  });

  it("rejects unsupported Markdown blocks rather than dropping them", () => {
    expect(() => parseMarkdown("> A block quote")).toThrow(UnsupportedMarkdownError);
  });

  it("rejects documents with no visible text", () => {
    expect(() => parseMarkdown(" \n\n")).toThrow(EmptyMarkdownError);
  });
});
