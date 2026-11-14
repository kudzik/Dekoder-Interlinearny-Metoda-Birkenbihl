import type { DecodedDocument, DecodedSentence, DecodedToken } from "../lib/decode/schema";

export interface ReaderCallbacks {
  onSpeakToken(token: string, tokenElement: HTMLElement): void;
  onSpeakSentence(sentence: DecodedSentence, sentenceElement: HTMLElement): void;
  onSpeakBlock(sentences: DecodedSentence[], blockElement: HTMLElement): void;
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
      blockElement.classList.add("font-semibold", "border-b", "border-stone-200", "pb-4", "dark:border-slate-700");
    }

    const blockControls = document.createElement("div");
    blockControls.className = "mb-2 flex items-center justify-end gap-2";
    const playBlockButton = createPlayButton("Odtwórz fragment");
    playBlockButton.classList.add("play-block-button");
    playBlockButton.innerHTML = `${playIcon}<span>Fragment</span>`;
    playBlockButton.addEventListener("click", () => callbacks.onSpeakBlock(block.sentences, blockElement));
    blockControls.append(playBlockButton);
    blockElement.append(blockControls);

    block.sentences.forEach((sentence, sentenceIndex) => {
      const sentenceElement = document.createElement("section");
      sentenceElement.className = "decoded-sentence";
      sentenceElement.dataset.sentenceId = sentence.id;

      const controls = document.createElement("div");
      controls.className = "sentence-controls";
      const sentenceLabel = document.createElement("span");
      sentenceLabel.className = "sr-only";
      sentenceLabel.textContent = `Zdanie ${sentence.id}`;
      const playButton = createPlayButton("Odtwórz zdanie");
      playButton.addEventListener("click", () => callbacks.onSpeakSentence(sentence, sentenceElement));
      if (sentenceIndex === 0) {
        blockControls.append(sentenceLabel, playButton);
      } else {
        controls.append(sentenceLabel, playButton);
      }

      const textContainer = document.createElement(block.type === "heading" ? `h${block.level ?? 1}` : "p");
      textContainer.className =
        block.type === "heading"
          ? block.level === 1
            ? "mb-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl"
            : "mb-2 mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100 sm:text-2xl"
          : "m-0";
      textContainer.classList.add("sentence-text");
      const tokensContainer = document.createElement("span");
      tokensContainer.className = "token-row flex flex-wrap items-end";
      sentence.tokens.forEach((token, tokenIndex) => {
        const key = `${sentence.id}-${tokenIndex}`;
        tokensContainer.append(createToken(token, key, mode, callbacks));
      });
      textContainer.append(tokensContainer);

      const naturalTranslation = document.createElement("p");
      naturalTranslation.className = "natural-translation mt-2 border-l-2 border-stone-300 pl-3 text-sm italic text-slate-600 dark:border-slate-600 dark:text-slate-300";
      naturalTranslation.hidden = !showNatural;
      naturalTranslation.textContent = `Tłumaczenie naturalne: ${sentence.natural_pl}`;

      if (sentenceIndex > 0) {
        sentenceElement.classList.add("decoded-sentence-with-control");
        sentenceElement.append(controls);
      }
      sentenceElement.append(textContainer, naturalTranslation);
      blockElement.append(sentenceElement);
    });

    reader.append(blockElement);
  });
}

const playIcon =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.3-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z"/></svg>';

function createPlayButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "play-audio-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = playIcon;
  return button;
}

function createToken(
  token: DecodedToken,
  tokenKey: string,
  mode: "decode" | "listen" | "test",
  callbacks: ReaderCallbacks,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `token${token.is_chunk ? " token-chunk" : ""}`;
  button.dataset.tokenKey = tokenKey;
  const setAccessibleLabel = () => {
    const revealed = callbacks.isRevealed(tokenKey);
    const glossIsHidden = mode === "test" && !revealed;
    const description = `${token.en}: ${token.pl_literal}${token.grammar ? `. ${token.grammar}` : ""}`;
    button.setAttribute("aria-label", glossIsHidden ? `${token.en}: glosa ukryta` : description);
    button.title = glossIsHidden ? `${token.en}: glosa ukryta` : description;
    if (mode === "test") button.setAttribute("aria-pressed", String(revealed));
  };
  setAccessibleLabel();
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
    setAccessibleLabel();
    callbacks.onSpeakToken(token.en, button);
    showGrammar(token, button);
  });
  button.addEventListener("mouseenter", () => {
    callbacks.onHoverToken(tokenKey);
    button.classList.toggle("revealed", callbacks.isRevealed(tokenKey));
    setAccessibleLabel();
    showGrammar(token, button);
  });
  button.addEventListener("mouseleave", () => {
    if (document.activeElement !== button) hideGrammar();
  });
  button.addEventListener("focus", () => {
    if (mode === "test") {
      callbacks.onHoverToken(tokenKey);
      button.classList.toggle("revealed", callbacks.isRevealed(tokenKey));
      setAccessibleLabel();
    }
    showGrammar(token, button);
  });
  button.addEventListener("blur", hideGrammar);
  return button;
}

function showGrammar(token: DecodedToken, anchor: HTMLElement): void {
  const popover = document.getElementById("grammar-popover");
  if (!popover) return;

  const header = document.createElement("div");
  header.className = "grammar-popover-header";
  const title = document.createElement("strong");
  title.className = "grammar-popover-title";
  title.textContent = token.en;
  header.append(title);
  if (token.is_chunk) {
    const badge = document.createElement("span");
    badge.className = "grammar-popover-badge";
    badge.textContent = "Zbitka / idiom";
    header.append(badge);
  }

  const gloss = document.createElement("p");
  gloss.className = "grammar-popover-gloss";
  gloss.textContent = `Dosłownie: „${token.pl_literal}”`;
  popover.replaceChildren(header, gloss);
  if (token.grammar) {
    const grammar = document.createElement("p");
    grammar.className = "grammar-popover-grammar";
    grammar.textContent = token.grammar;
    popover.append(grammar);
  }

  popover.style.left = "0px";
  popover.style.top = "0px";
  popover.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const edge = 8;
  const gap = 8;
  const left = Math.max(
    edge,
    Math.min(rect.left + (rect.width - popoverRect.width) / 2, window.innerWidth - popoverRect.width - edge),
  );
  const above = rect.top - popoverRect.height - gap;
  const below = rect.bottom + gap;
  const top =
    above >= edge
      ? above
      : below + popoverRect.height <= window.innerHeight - edge
        ? below
        : Math.max(edge, Math.min(above, window.innerHeight - popoverRect.height - edge));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

}

function hideGrammar(): void {
  const popover = document.getElementById("grammar-popover");
  if (popover) popover.hidden = true;
}

window.addEventListener("scroll", hideGrammar, { capture: true, passive: true });
window.addEventListener("resize", hideGrammar);
