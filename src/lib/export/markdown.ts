import type { DecodedDocument } from "../decode/schema";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeTableCell(text: string): string {
  return escapeHtml(text).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

const TOKENS_PER_TABLE = 4;

function interlinearTables(tokens: DecodedDocument["blocks"][number]["sentences"][number]["tokens"]): string[] {
  const lines: string[] = [];
  for (let start = 0; start < tokens.length; start += TOKENS_PER_TABLE) {
    const group = tokens.slice(start, start + TOKENS_PER_TABLE);
    lines.push(
      `| ${group.map((token) => escapeTableCell(token.pl_literal)).join(" | ")} |`,
      `| ${group.map(() => ":---:").join(" | ")} |`,
      `| ${group.map((token) => `**${escapeTableCell(token.en)}**`).join(" | ")} |`,
      "",
    );
  }
  return lines;
}

export function createMarkdownExport(document: DecodedDocument): string {
  const lines = [
    "<!-- Wygenerowano w Dekoderze Interlinearnym (Metoda Birkenbihl) -->",
    "",
    "# Arkusz dekodowania",
    "",
    "> **Jak czytać:** polskie znaczenie znajduje się w górnym wierszu, bezpośrednio nad odpowiadającym mu angielskim słowem lub zwrotem.",
    "",
    "---",
    "",
  ];

  for (const block of document.blocks) {
    for (const sentence of block.sentences) {
      const english = sentence.tokens.map((token) => escapeHtml(token.en)).join(" ");

      if (block.type === "heading") {
        lines.push(`${"#".repeat(Math.min((block.level ?? 1) + 1, 6))} ${english}`, "");
      } else {
        if (block.type === "list-item") lines.push("**Element listy:**", "");
      }
      lines.push(...interlinearTables(sentence.tokens));
      if (sentence.natural_pl) lines.push(`> **Naturalnie:** *${escapeHtml(sentence.natural_pl)}*`);
      lines.push("");
    }
    if (block.type !== "heading") lines.push("---", "");
  }

  return lines.join("\n").trimEnd();
}
