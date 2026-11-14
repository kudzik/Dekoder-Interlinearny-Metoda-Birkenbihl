import type { DecodedDocument } from "../decode/schema";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createMarkdownExport(document: DecodedDocument): string {
  const lines = [
    "<!-- Wygenerowano w Dekoderze Interlinearnym (Metoda Birkenbihl) -->",
    "",
    "# Arkusz dekodowania",
    "",
    "> **Jak czytać:** najpierw przeczytaj angielskie zdanie, następnie porównaj je z przekładem dosłownym. Na końcu sprawdź naturalne tłumaczenie.",
    "",
    "---",
    "",
  ];

  for (const block of document.blocks) {
    for (const sentence of block.sentences) {
      const english = sentence.tokens.map((token) => escapeHtml(token.en)).join(" ");
      const literal = sentence.tokens.map((token) => escapeHtml(token.pl_literal)).join(" · ");

      if (block.type === "heading") {
        lines.push(`${"#".repeat(Math.min((block.level ?? 1) + 1, 6))} ${english}`, "");
      } else {
        const itemPrefix = block.type === "list-item" ? "- " : "";
        lines.push(`${itemPrefix}**EN:** ${english}`);
      }
      lines.push(`  **PL dosłownie:** ${literal}`);
      if (sentence.natural_pl) lines.push(`  **PL naturalnie:** *${escapeHtml(sentence.natural_pl)}*`);
      lines.push("");
    }
    if (block.type !== "heading") lines.push("---", "");
  }

  return lines.join("\n").trimEnd();
}
