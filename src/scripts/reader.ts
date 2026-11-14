import type { DecodedDocument, DecodedSentence, DecodedToken } from "../lib/decode/schema";

export interface ReaderCallbacks {
  onSpeakToken(token: string, tokenElement: HTMLElement): void;
  onSpeakSentence(sentence: DecodedSentence, sentenceElement: HTMLElement): void;
  onReveal(tokenKey: string): void;
  onHoverToken(tokenKey: string): void;
  isRevealed(tokenKey: string): boolean;
}

export function renderDocument(
  reader: HTMLElement,
  decodedDocument: DecodedDocument,
  mode: "decode" | "listen" | "test",
  showNatural: boolean,
  callbacks: ReaderCallbacks,
): void {
  reader.replaceChildren();
  reader.classList.remove("mode-decode", "mode-listen", "mode-test");
  reader.classList.add(`mode-${mode}`);

  decodedDocument.blocks.forEach((block, blockIndex) => {
    const blockElement = document.createElement("div");
    blockElement.className = "decoded-block rounded-xl p-3 transition-colors";

    if (block.type === "list-item") {
      blockElement.classList.add("border-l-2", "border-teal-500/50", "ml-3");
      blockElement.setAttribute("aria-label", `Element listy ${blockIndex + 1}`);
    } else if (block.type === "heading") {
      blockElement.classList.add("font-semibold");
    }

    block.sentences.forEach((sentence) => {
      const sentenceElement = document.createElement("section");
      sentenceElement.className = "decoded-sentence";
      sentenceElement.dataset.sentenceId = sentence.id;

      const controls = document.createElement("div");
      controls.className = "mb-2 flex items-center justify-between gap-2";
      const sentenceLabel = document.createElement("span");
      sentenceLabel.className = "sr-only";
      sentenceLabel.textContent = `Zdanie ${sentence.id}`;
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "rounded-md px-2 py-1 text-xs text-teal-800 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-slate-800";
      playButton.textContent = "Odtwórz zdanie";
      playButton.addEventListener("click", () => callbacks.onSpeakSentence(sentence, sentenceElement));
      controls.append(sentenceLabel, playButton);

      const textContainer = document.createElement(block.type === "heading" ? `h${block.level ?? 1}` : "p");
      textContainer.className = block.type === "heading" ? "mb-2" : "m-0";
      const tokensContainer = document.createElement("span");
      tokensContainer.className = "flex flex-wrap items-end";
      sentence.tokens.forEach((token, tokenIndex) => {
        const key = `${sentence.id}-${tokenIndex}`;
        tokensContainer.append(createToken(token, key, callbacks));
      });
      textContainer.append(tokensContainer);

      const naturalTranslation = document.createElement("p");
      naturalTranslation.className = "natural-translation mt-2 border-l-2 border-stone-300 pl-3 text-sm italic text-slate-600 dark:border-slate-600 dark:text-slate-300";
      naturalTranslation.hidden = !showNatural;
      naturalTranslation.textContent = `Tłumaczenie naturalne: ${sentence.natural_pl}`;

      sentenceElement.append(controls, textContainer, naturalTranslation);
      blockElement.append(sentenceElement);
    });

    reader.append(blockElement);
  });
}

function createToken(
  token: DecodedToken,
  tokenKey: string,
  callbacks: ReaderCallbacks,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `token${token.is_chunk ? " token-chunk" : ""}`;
  button.dataset.tokenKey = tokenKey;
  button.setAttribute("aria-label", `${token.en}: ${token.pl_literal}${token.grammar ? `. ${token.grammar}` : ""}`);
  button.title = [token.en, token.pl_literal, token.grammar].filter(Boolean).join(" — ");
  if (callbacks.isRevealed(tokenKey)) button.classList.add("revealed");

  const gloss = document.createElement("span");
  gloss.className = "token-gloss";
  gloss.textContent = token.pl_literal;
  const english = document.createElement("span");
  english.className = "token-en";
  english.textContent = token.en;
  button.append(gloss, english);

  button.addEventListener("click", () => {
    callbacks.onReveal(tokenKey);
    button.classList.toggle("revealed", callbacks.isRevealed(tokenKey));
    callbacks.onSpeakToken(token.en, button);
    showGrammar(token, button);
  });
  button.addEventListener("mouseenter", () => {
    callbacks.onHoverToken(tokenKey);
    showGrammar(token, button);
  });
  button.addEventListener("mouseleave", () => {
    if (document.activeElement !== button) hideGrammar();
  });
  button.addEventListener("focus", () => showGrammar(token, button));
  button.addEventListener("blur", hideGrammar);
  return button;
}

function showGrammar(token: DecodedToken, anchor: HTMLElement): void {
  const popover = document.getElementById("grammar-popover");
  if (!popover) return;
  popover.textContent = [token.en, token.pl_literal, token.grammar].filter(Boolean).join(" — ");
  popover.hidden = false;
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 300))}px`;
  popover.style.top = `${Math.max(8, rect.top - popover.offsetHeight - 8)}px`;
}

function hideGrammar(): void {
  const popover = document.getElementById("grammar-popover");
  if (popover) popover.hidden = true;
}
