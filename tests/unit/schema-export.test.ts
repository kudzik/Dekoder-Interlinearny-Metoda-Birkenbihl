import { describe, expect, it } from "vitest";
import { createStandaloneHtml } from "../../src/lib/export/html";
import { createMarkdownExport } from "../../src/lib/export/markdown";
import { DecodedDocumentSchema, type DecodedDocument } from "../../src/lib/decode/schema";

const validDocument: DecodedDocument = {
  blocks: [
    {
      type: "paragraph",
      sentences: [
        {
          id: "1-1",
          natural_pl: "Jestem gotowy.",
          tokens: [
            { en: "I", pl_literal: "Ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "am ready.", pl_literal: "jestem gotowy.", is_chunk: false },
          ],
        },
      ],
    },
  ],
};

describe("decoded document contract and exports", () => {
  it("accepts the required contract and rejects the prototype's old token shape", () => {
    expect(DecodedDocumentSchema.safeParse(validDocument).success).toBe(true);
    expect(
      DecodedDocumentSchema.safeParse({
        blocks: [{ type: "p", tokens: [{ en: "word", pl_literal: "słowo", isChunk: false }] }],
      }).success,
    ).toBe(false);
  });

  it("escapes model text in both exports and keeps HTML offline", () => {
    const untrusted: DecodedDocument = {
      blocks: [
        {
          type: "paragraph",
          sentences: [
            {
              id: "1-1",
              natural_pl: "<script>alert(1)</script>",
              tokens: [
                { en: "<img src=x onerror=alert(1)>", pl_literal: "<b>glosa</b>", is_chunk: false },
              ],
            },
          ],
        },
      ],
    };

    const markdown = createMarkdownExport(untrusted);
    const html = createStandaloneHtml(untrusted);

    expect(markdown).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<script src=");
  });
});
