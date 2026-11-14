import type { DecodedSentence } from "../lib/decode/schema";
import type { SpeechAccent } from "../lib/speech/schema";

const MIN_PLAYBACK_RATE = 0.6;
const MAX_PLAYBACK_RATE = 1.2;
const MAX_CACHED_AUDIO = 32;

interface TokenRange {
  start: number;
  end: number;
  element?: HTMLElement;
}

export class SpeechController {
  private sequence = 0;
  private playingAll = false;
  private requestController: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private finishPlayback: (() => void) | null = null;
  private readonly audioCache = new Map<string, Blob>();
  private systemVoices: SpeechSynthesisVoice[] = [];

  constructor(
    private readonly voiceSelect: HTMLSelectElement,
    private readonly rateSelect: HTMLSelectElement,
    private readonly playAllButton: HTMLButtonElement,
  ) {
    this.loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", () => this.loadVoices());
    }
    this.voiceSelect.addEventListener("change", () => {
      this.stop();
      this.clearSpeechStatus();
    });
  }

  stop(): void {
    this.sequence += 1;
    this.playingAll = false;
    this.requestController?.abort();
    this.requestController = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.audio?.pause();
    this.finishPlayback?.();
    this.finishPlayback = null;
    this.updatePlayButton();
    document.querySelectorAll(".speaking-block,.speaking-token").forEach((element) => {
      element.classList.remove("speaking-block", "speaking-token");
    });
  }

  speakToken(text: string, element: HTMLElement): void {
    const run = this.begin();
    void this.playText(text, element, run).catch((error: unknown) => this.showError(error, run));
  }

  speakSentence(sentence: DecodedSentence, element: HTMLElement): void {
    const run = this.begin();
    void this.playSentence(sentence, element, run).catch((error: unknown) => this.showError(error, run));
  }

  speakBlock(sentences: DecodedSentence[], element: HTMLElement): void {
    if (sentences.length === 0) return;
    const run = this.begin();
    const tokens = sentences.flatMap((sentence) => sentence.tokens);
    const tokenElements = Array.from(element.querySelectorAll<HTMLElement>(".token"));
    const { text, ranges } = this.createTokenRanges(
      tokens.map((token) => token.en),
      tokenElements,
    );
    void this.playText(text, element, run, "speaking-block", ranges).catch((error: unknown) =>
      this.showError(error, run),
    );
  }

  async playAll(sentences: Array<{ sentence: DecodedSentence; element: HTMLElement }>): Promise<void> {
    if (sentences.length === 0) return;
    const run = this.begin();
    this.playingAll = true;
    this.updatePlayButton();

    try {
      for (const item of sentences) {
        if (run !== this.sequence) break;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        item.element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
        await this.playSentence(item.sentence, item.element, run);
        if (run === this.sequence) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (error) {
      this.showError(error, run);
    } finally {
      if (run === this.sequence) {
        this.playingAll = false;
        this.updatePlayButton();
      }
    }
  }

  private begin(): number {
    this.stop();
    this.clearSpeechStatus();
    return this.sequence;
  }

  private clearSpeechStatus(): void {
    const status = document.getElementById("speech-status");
    if (status) status.textContent = "";
  }

  private loadVoices(): void {
    const previousSelection = this.voiceSelect.value;
    this.systemVoices =
      "speechSynthesis" in window
        ? window.speechSynthesis
            .getVoices()
            .filter((voice) => /^en([-_]|$)/i.test(voice.lang))
        : [];

    const geminiVoices = document.createElement("optgroup");
    geminiVoices.label = "Gemini — naturalna wymowa";
    geminiVoices.append(
      new Option("Gemini · English (UK)", "gemini:en-GB"),
      new Option("Gemini · English (US)", "gemini:en-US"),
    );
    this.voiceSelect.replaceChildren(geminiVoices);

    const systemVoiceOptions = document.createElement("optgroup");
    systemVoiceOptions.label = "Głosy systemowe — szybkie / lokalne";
    if (this.systemVoices.length === 0) {
      const unavailable = new Option("Brak głosów angielskich", "system:unavailable");
      unavailable.disabled = true;
      systemVoiceOptions.append(unavailable);
    } else {
      for (const voice of this.systemVoices) {
        const name = voice.name.replace(/^(Microsoft|Google|Apple)\s+/i, "");
        systemVoiceOptions.append(new Option(`${voice.lang} · ${name}`, `system:${voice.voiceURI}`));
      }
    }
    this.voiceSelect.append(systemVoiceOptions);

    const hasPreviousSelection = Array.from(this.voiceSelect.options).some(
      (option) => option.value === previousSelection && !option.disabled,
    );
    this.voiceSelect.value = hasPreviousSelection ? previousSelection : "gemini:en-GB";
    const voiceHelp = document.getElementById("voice-help");
    if (voiceHelp) {
      voiceHelp.textContent =
        this.systemVoices.length > 0
          ? "Gemini brzmi naturalniej, ale może odpowiadać wolniej. Głos systemowy działa lokalnie i zwykle szybciej."
          : "Brak angielskiego głosu systemowego w tej przeglądarce. Zainstaluj głos en-GB lub en-US, aby użyć szybszej opcji lokalnej.";
    }
  }

  private updatePlayButton(): void {
    const label = this.playAllButton.querySelector<HTMLElement>("[data-play-label]");
    if (label) label.textContent = this.playingAll ? "Zatrzymaj" : "Czytaj całość";
    else this.playAllButton.textContent = this.playingAll ? "Zatrzymaj" : "Czytaj całość";
    this.playAllButton.setAttribute("aria-pressed", String(this.playingAll));
    this.playAllButton.classList.toggle("is-playing", this.playingAll);
  }

  private playSentence(sentence: DecodedSentence, element: HTMLElement, run: number): Promise<void> {
    const tokenElements = Array.from(element.querySelectorAll<HTMLElement>(".token"));
    const { text, ranges } = this.createTokenRanges(
      sentence.tokens.map((token) => token.en),
      tokenElements,
    );
    return this.playText(text, element, run, "speaking-block", ranges);
  }

  private createTokenRanges(tokens: string[], elements: HTMLElement[]): { text: string; ranges: TokenRange[] } {
    let text = "";
    const ranges = tokens.map((token, index) => {
      const start = text.length;
      text += token;
      const range = { start, end: text.length, element: elements[index] };
      text += " ";
      return range;
    });
    return { text: text.trim(), ranges };
  }

  private async playText(
    text: string,
    element: HTMLElement | undefined,
    run: number,
    highlightClass = "speaking-token",
    tokenRanges: TokenRange[] = [],
  ): Promise<void> {
    if (this.voiceSelect.value.startsWith("system:")) {
      await this.playSystemVoice(text, element, run, highlightClass, tokenRanges);
      return;
    }

    const blob = await this.getAudio(text, run);
    if (run !== this.sequence) return;
    await this.playBlob(blob, element, highlightClass);
  }

  private playSystemVoice(
    text: string,
    element: HTMLElement | undefined,
    run: number,
    highlightClass: string,
    tokenRanges: TokenRange[],
  ): Promise<void> {
    if (!("speechSynthesis" in window)) {
      return Promise.reject(new Error("Ta przeglądarka nie obsługuje głosów systemowych."));
    }
    const voiceUri = this.voiceSelect.value.slice("system:".length);
    const voice = this.systemVoices.find((item) => item.voiceURI === voiceUri);
    if (!voice) return Promise.reject(new Error("Wybrany głos systemowy nie jest już dostępny."));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = Math.min(
      MAX_PLAYBACK_RATE,
      Math.max(MIN_PLAYBACK_RATE, Number(this.rateSelect.value) || 1),
    );
    element?.classList.add(highlightClass);

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        element?.classList.remove(highlightClass);
        tokenRanges.forEach((range) => range.element?.classList.remove("speaking-token"));
        if (this.finishPlayback === cancelPlayback) this.finishPlayback = null;
        if (error) reject(error);
        else resolve();
      };
      const cancelPlayback = () => finish();

      this.finishPlayback = cancelPlayback;
      utterance.onboundary = (event) => {
        if (run !== this.sequence || event.name !== "word") return;
        for (const range of tokenRanges) {
          range.element?.classList.toggle(
            "speaking-token",
            event.charIndex >= range.start && event.charIndex <= range.end,
          );
        }
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) => {
        if (run !== this.sequence || event.error === "canceled" || event.error === "interrupted") {
          finish();
        } else {
          finish(new Error("Nie udało się odtworzyć głosu systemowego."));
        }
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  private async getAudio(text: string, run: number): Promise<Blob> {
    const accent: SpeechAccent = this.voiceSelect.value === "gemini:en-US" ? "en-US" : "en-GB";
    const key = `${accent}\n${text}`;
    const cached = this.audioCache.get(key);
    if (cached) {
      this.audioCache.delete(key);
      this.audioCache.set(key, cached);
      return cached;
    }

    const controller = new AbortController();
    this.requestController = controller;
    let response: Response;
    try {
      response = await fetch("/api/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, accent }),
        signal: controller.signal,
      });
    } finally {
      if (this.requestController === controller) this.requestController = null;
    }

    if (run !== this.sequence) throw new DOMException("Odtwarzanie zatrzymano.", "AbortError");
    if (!response.ok) {
      let message = `Synteza mowy nie powiodła się (HTTP ${response.status}).`;
      try {
        const body: unknown = await response.json();
        if (
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
        ) {
          message = body.error.message;
        }
      } catch {
        throw new Error(message);
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    if (blob.size === 0 || !/^audio\/wav(?:$|;)/i.test(blob.type)) {
      throw new Error("Serwer nie zwrócił poprawnego dźwięku WAV.");
    }
    if (run !== this.sequence) throw new DOMException("Odtwarzanie zatrzymano.", "AbortError");

    this.audioCache.set(key, blob);
    if (this.audioCache.size > MAX_CACHED_AUDIO) {
      const oldest = this.audioCache.keys().next().value;
      if (oldest !== undefined) this.audioCache.delete(oldest);
    }
    return blob;
  }

  private playBlob(blob: Blob, element: HTMLElement | undefined, highlightClass: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.audioUrl = url;
    this.audio = audio;
    audio.playbackRate = Math.min(
      MAX_PLAYBACK_RATE,
      Math.max(MIN_PLAYBACK_RATE, Number(this.rateSelect.value) || 1),
    );
    element?.classList.add(highlightClass);

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        element?.classList.remove(highlightClass);
        if (this.audio === audio) this.audio = null;
        if (this.audioUrl === url) {
          URL.revokeObjectURL(url);
          this.audioUrl = null;
        }
        if (this.finishPlayback === cancelPlayback) this.finishPlayback = null;
        audio.removeAttribute("src");
        audio.load();
        if (error) reject(error);
        else resolve();
      };
      const cancelPlayback = () => finish();

      this.finishPlayback = cancelPlayback;
      audio.addEventListener("ended", () => finish(), { once: true });
      audio.addEventListener("error", () => finish(new Error("Nie udało się odtworzyć dźwięku.")), {
        once: true,
      });
      void audio.play().catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error("Nie udało się rozpocząć odtwarzania."));
      });
    });
  }

  private showError(error: unknown, run: number): void {
    if (run !== this.sequence || (error instanceof DOMException && error.name === "AbortError")) return;
    const status = document.getElementById("speech-status");
    if (status) {
      status.textContent = error instanceof Error ? error.message : "Wystąpił nieznany błąd syntezy mowy.";
    }
    this.playingAll = false;
    this.updatePlayButton();
  }
}
