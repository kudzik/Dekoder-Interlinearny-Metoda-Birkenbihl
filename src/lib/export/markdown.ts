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
  const lines = ["<!-- Wygenerowano w Dekoderze Interlinearnym (Metoda Birkenbihl) -->", ""];

  for (const block of document.blocks) {
    const prefix =
      block.type === "heading"
        ? `${"#".repeat(block.level ?? 1)} `
        : block.type === "list-item"
          ? "- "
          : "";

    for (const sentence of block.sentences) {
      const ruby = sentence.tokens
        .map((token) => `<ruby>${escapeHtml(token.en)}<rt>${escapeHtml(token.pl_literal)}</rt></ruby>`)
        .join(" ");
      lines.push(`${prefix}${ruby}`);
      if (sentence.natural_pl) lines.push(`> *Tłumaczenie: ${escapeHtml(sentence.natural_pl)}*`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
