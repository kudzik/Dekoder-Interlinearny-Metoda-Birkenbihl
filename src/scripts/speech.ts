import type { DecodedSentence } from "../lib/decode/schema";
import type { SpeechAccent } from "../lib/speech/schema";

const MIN_PLAYBACK_RATE = 0.6;
const MAX_PLAYBACK_RATE = 1.2;
const MAX_CACHED_AUDIO = 32;

export class SpeechController {
  private sequence = 0;
  private playingAll = false;
  private requestController: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private finishPlayback: (() => void) | null = null;
  private readonly audioCache = new Map<string, Blob>();

  constructor(
    private readonly voiceSelect: HTMLSelectElement,
    private readonly rateSelect: HTMLSelectElement,
    private readonly playAllButton: HTMLButtonElement,
  ) {
    this.voiceSelect.replaceChildren(
      new Option("Angielski brytyjski", "en-GB"),
      new Option("Angielski amerykański", "en-US"),
    );
    this.voiceSelect.value = "en-GB";
  }

  stop(): void {
    this.sequence += 1;
    this.playingAll = false;
    this.requestController?.abort();
    this.requestController = null;
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

  async playAll(sentences: Array<{ sentence: DecodedSentence; element: HTMLElement }>): Promise<void> {
    if (sentences.length === 0) return;
    const run = this.begin();
    this.playingAll = true;
    this.updatePlayButton();

    try {
      for (const item of sentences) {
        if (run !== this.sequence) break;
        item.element.scrollIntoView({ behavior: "smooth", block: "center" });
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
    return this.sequence;
  }

  private updatePlayButton(): void {
    this.playAllButton.textContent = this.playingAll ? "Zatrzymaj" : "Czytaj całość";
    this.playAllButton.setAttribute("aria-pressed", String(this.playingAll));
  }

  private async playSentence(sentence: DecodedSentence, element: HTMLElement, run: number): Promise<void> {
    const text = sentence.tokens.map((token) => token.en).join(" ");
    await this.playText(text, element, run, "speaking-block");
  }

  private async playText(
    text: string,
    element: HTMLElement | undefined,
    run: number,
    highlightClass = "speaking-token",
  ): Promise<void> {
    const blob = await this.getAudio(text, run);
    if (run !== this.sequence) return;
    await this.playBlob(blob, element, highlightClass);
  }

  private async getAudio(text: string, run: number): Promise<Blob> {
    const accent: SpeechAccent = this.voiceSelect.value === "en-US" ? "en-US" : "en-GB";
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
    const status = document.getElementById("status-message");
    if (status) {
      status.textContent = error instanceof Error ? error.message : "Wystąpił nieznany błąd syntezy mowy.";
    }
    this.playingAll = false;
    this.updatePlayButton();
  }
}
