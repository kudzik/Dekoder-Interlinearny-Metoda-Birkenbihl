import type { DecodedSentence } from "../lib/decode/schema";

export class SpeechController {
  private voices: SpeechSynthesisVoice[] = [];
  private sequence = 0;
  private playingAll = false;

  constructor(
    private readonly voiceSelect: HTMLSelectElement,
    private readonly rateSelect: HTMLSelectElement,
    private readonly playAllButton: HTMLButtonElement,
  ) {
    if (!("speechSynthesis" in window)) {
      this.voiceSelect.replaceChildren(new Option("Brak obsługi syntezatora mowy", ""));
      this.voiceSelect.disabled = true;
      return;
    }
    this.loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => this.loadVoices());
  }

  stop(): void {
    this.sequence += 1;
    this.playingAll = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.updatePlayButton();
    document.querySelectorAll(".speaking-block,.speaking-token").forEach((element) => {
      element.classList.remove("speaking-block", "speaking-token");
    });
  }

  speakToken(text: string, element: HTMLElement): void {
    if (!("speechSynthesis" in window)) {
      this.showUnsupportedMessage();
      return;
    }
    this.stop();
    this.speak(text, element);
  }

  speakSentence(sentence: DecodedSentence, element: HTMLElement): void {
    if (!("speechSynthesis" in window)) {
      this.showUnsupportedMessage();
      return;
    }
    this.stop();
    this.playSentence(sentence, element, this.sequence);
  }

  async playAll(sentences: Array<{ sentence: DecodedSentence; element: HTMLElement }>): Promise<void> {
    if (!("speechSynthesis" in window)) {
      this.showUnsupportedMessage();
      return;
    }
    this.stop();
    const run = this.sequence;
    this.playingAll = true;
    this.updatePlayButton();

    for (const item of sentences) {
      if (run !== this.sequence) break;
      item.element.scrollIntoView({ behavior: "smooth", block: "center" });
      await this.playSentence(item.sentence, item.element, run);
      if (run === this.sequence) await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (run === this.sequence) {
      this.playingAll = false;
      this.updatePlayButton();
    }
  }

  private loadVoices(): void {
    const allVoices = window.speechSynthesis.getVoices();
    this.voices = allVoices.filter((voice) => /^(en-GB|en-US)/i.test(voice.lang));
    const options = this.voices.map((voice, index) => {
      const label = voice.lang.toLowerCase() === "en-gb" ? "🇬🇧" : "🇺🇸";
      return new Option(`${label} ${voice.name}`, String(index));
    });
    this.voiceSelect.replaceChildren(
      ...(options.length > 0 ? options : [new Option("Domyślny głos angielski", "")]),
    );
  }

  private updatePlayButton(): void {
    this.playAllButton.textContent = this.playingAll ? "Zatrzymaj" : "Czytaj całość";
    this.playAllButton.setAttribute("aria-pressed", String(this.playingAll));
  }

  private showUnsupportedMessage(): void {
    const status = document.getElementById("status-message");
    if (status) status.textContent = "Twoja przeglądarka nie obsługuje syntezatora mowy.";
  }

  private playSentence(sentence: DecodedSentence, element: HTMLElement, run: number): Promise<void> {
    const words = Array.from(element.querySelectorAll<HTMLButtonElement>(".token"));
    let text = "";
    const ranges = sentence.tokens.map((token, index) => {
      const start = text.length;
      text += token.en;
      const end = text.length;
      text += " ";
      return { start, end, word: words[index] };
    });
    element.classList.add("speaking-block");
    return this.speak(text.trim(), undefined, (event) => {
      if (run !== this.sequence || event.name !== "word") return;
      for (const range of ranges) {
        range.word?.classList.toggle(
          "speaking-token",
          event.charIndex >= range.start && event.charIndex <= range.end,
        );
      }
    }, () => {
      element.classList.remove("speaking-block");
    });
  }

  private speak(
    text: string,
    tokenElement?: HTMLElement,
    onBoundary?: (event: SpeechSynthesisEvent) => void,
    onComplete?: () => void,
  ): Promise<void> {
    if (!("speechSynthesis" in window)) return Promise.resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedIndex = Number.parseInt(this.voiceSelect.value, 10);
    const voice = Number.isFinite(selectedIndex) ? this.voices[selectedIndex] : undefined;
    utterance.voice = voice ?? null;
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = Number(this.rateSelect.value) || 1;
    if (tokenElement) tokenElement.classList.add("speaking-token");
    return new Promise((resolve) => {
      utterance.onboundary = (event) => onBoundary?.(event);
      utterance.onend = utterance.onerror = () => {
        tokenElement?.classList.remove("speaking-token");
        onComplete?.();
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  }
}
