import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { List, ListItem, RootContent } from "mdast";
import type { SourceBlock, SourceSentence } from "./schema";

export class UnsupportedMarkdownError extends Error {
  constructor(nodeType: string) {
    super(`Nieobsługiwany element Markdown: ${nodeType}. Użyj nagłówków, akapitów lub list.`);
    this.name = "UnsupportedMarkdownError";
  }
}

export class EmptyMarkdownError extends Error {
  constructor() {
    super("W tekście nie znaleziono treści do dekodowania.");
    this.name = "EmptyMarkdownError";
  }
}

function splitSentences(text: string): string[] {
  const Segmenter = Intl.Segmenter;
  const parts = Segmenter
    ? [...new Segmenter("en", { granularity: "sentence" }).segment(text)].map(({ segment }) => segment.trim())
    : text.match(/[^.!?]+(?:[.!?]+["')\]]*)?/g)?.map((part) => part.trim()) ?? [];

  return parts.filter(Boolean);
}

function createBlock(
  type: SourceBlock["type"],
  text: string,
  blockIndex: number,
  level?: number,
): SourceBlock | null {
  const sentences: SourceSentence[] = splitSentences(text).map((sentence, sentenceIndex) => ({
    id: `${blockIndex + 1}-${sentenceIndex + 1}`,
    text: sentence,
  }));
  if (sentences.length === 0) return null;

  return {
    type,
    ...(level === undefined ? {} : { level }),
    sentences,
  };
}

function listItemText(item: ListItem): string {
  return toString(item).trim();
}

function appendListItems(
  list: List,
  blocks: SourceBlock[],
): void {
  for (const item of list.children) {
    const text = listItemText(item);
    const block = createBlock("list-item", text, blocks.length);
    if (block) blocks.push(block);
  }
}

export function parseMarkdown(markdown: string): SourceBlock[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const blocks: SourceBlock[] = [];

  for (const node of tree.children as RootContent[]) {
    let block: SourceBlock | null = null;
    switch (node.type) {
      case "heading":
        block = createBlock("heading", toString(node).trim(), blocks.length, node.depth);
        break;
      case "paragraph":
        block = createBlock("paragraph", toString(node).trim(), blocks.length);
        break;
      case "list":
        appendListItems(node, blocks);
        continue;
      default:
        throw new UnsupportedMarkdownError(node.type);
    }

    if (block) blocks.push(block);
  }

  if (blocks.length === 0) throw new EmptyMarkdownError();
  if (blocks.length > 100 || blocks.reduce((sum, block) => sum + block.sentences.length, 0) > 200) {
    throw new RangeError("Tekst zawiera zbyt wiele bloków lub zdań do jednego dekodowania.");
  }

  return blocks;
}
