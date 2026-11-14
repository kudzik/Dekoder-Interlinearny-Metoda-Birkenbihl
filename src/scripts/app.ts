import { createMarkdownExport } from "../lib/export/markdown";
import { createStandaloneHtml } from "../lib/export/html";
import { findSavedLesson, getMostRecentLesson, saveLesson } from "../lib/storage/lessons";
import { DecodedDocumentSchema, type DecodedDocument } from "../lib/decode/schema";
import { SAMPLE_DECODED_DOCUMENT, SAMPLE_MARKDOWN } from "../lib/decode/sample";
import { renderDocument } from "./reader";
import { SpeechController } from "./speech";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Nie znaleziono elementu interfejsu: ${id}`);
  return element as T;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const objectUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function initializeApp(): void {
  const markdownInput = getElement<HTMLTextAreaElement>("markdown-input");
  const workspace = getElement<HTMLElement>("workspace");
  const reader = getElement<HTMLElement>("reader");
  const status = getElement<HTMLElement>("status-message");
  const decodeButton = getElement<HTMLButtonElement>("decode-button");
  const decodeButtonLabel = decodeButton.querySelector<HTMLElement>("[data-decode-label]");
  if (!decodeButtonLabel) throw new Error("Nie znaleziono etykiety przycisku dekodowania.");
  const naturalToggle = getElement<HTMLInputElement>("show-natural");
  const testCounter = getElement<HTMLElement>("test-counter");
  const playAllButton = getElement<HTMLButtonElement>("play-all");
  const voiceSelect = getElement<HTMLSelectElement>("voice-select");
  const rateSelect = getElement<HTMLSelectElement>("rate-select");
  const speech = new SpeechController(voiceSelect, rateSelect, playAllButton);

  let currentData: DecodedDocument | null = null;
  let currentMode: "decode" | "listen" | "test" = "decode";
  let showNatural = false;
  const revealedTokens = new Set<string>();

  const updateTestCounter = () => {
    testCounter.textContent =
      currentMode === "test" ? `Odkryte słowa: ${revealedTokens.size}` : "";
  };

  const render = () => {
    if (!currentData) return;
    renderDocument(reader, currentData, currentMode, showNatural, {
      onSpeakToken: (text, element) => speech.speakToken(text, element),
      onSpeakSentence: (sentence, element) => speech.speakSentence(sentence, element),
      onSpeakBlock: (sentences, element) => speech.speakBlock(sentences, element),
      onReveal: (key) => {
        if (currentMode !== "test") return;
        revealedTokens.add(key);
        updateTestCounter();
      },
      onHoverToken: (key) => {
        if (currentMode !== "test") return;
        revealedTokens.add(key);
        updateTestCounter();
      },
      isRevealed: (key) => revealedTokens.has(key),
    });
    updateTestCounter();
  };

  const showDocument = (data: DecodedDocument, markdown: string, persist = false): boolean => {
    currentData = DecodedDocumentSchema.parse(data);
    revealedTokens.clear();
    workspace.classList.remove("hidden");
    render();
    return persist ? saveLesson(markdown, currentData) : true;
  };

  const restoreFromCache = (markdown: string): boolean => {
    const saved = findSavedLesson(markdown);
    if (!saved) return false;
    showDocument(saved, markdown);
    status.textContent = "Wczytano zapisaną lekcję — nie wysłano ponownie tekstu do AI.";
    return true;
  };

  const decode = async () => {
    const markdown = markdownInput.value.trim();
    if (!markdown) {
      status.textContent = "Wpisz lub wczytaj tekst Markdown.";
      markdownInput.focus();
      return;
    }

    if (restoreFromCache(markdown)) return;

    speech.stop();
    decodeButton.disabled = true;
    decodeButtonLabel.textContent = "Dekodowanie…";
    status.textContent = "Tekst jest dekodowany przez AI. Nie zamykaj tej karty.";
    const progressTimer = setTimeout(() => {
      status.textContent = "Gemini nadal przetwarza tekst. Jeśli przekroczy limit czasu, pokaże się komunikat błędu.";
    }, 15_000);
    try {
      const response = await fetch("/api/decode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown }),
      });

      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : `Dekodowanie nie powiodło się (HTTP ${response.status}).`;
        throw new Error(message);
      }

      const decoded = DecodedDocumentSchema.parse(body);
      const saved = showDocument(decoded, markdown, true);
      status.textContent = saved
        ? "Tekst został zdekodowany i zapisany lokalnie."
        : "Tekst został zdekodowany, ale przeglądarka nie mogła go zapisać lokalnie.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Wystąpił nieznany błąd dekodowania.";
    } finally {
      clearTimeout(progressTimer);
      decodeButton.disabled = false;
      decodeButtonLabel.textContent = "Dekoduj tekst (AI)";
    }
  };

  const latestLesson = getMostRecentLesson();
  markdownInput.value = latestLesson?.markdown ?? SAMPLE_MARKDOWN;
  if (latestLesson) {
    restoreFromCache(latestLesson.markdown);
  } else {
    showDocument(SAMPLE_DECODED_DOCUMENT, SAMPLE_MARKDOWN);
    status.textContent = "Wczytano gotową próbkę — przykładowe dane, bez wysyłania tekstu do Gemini.";
  }

  getElement<HTMLButtonElement>("decode-button").addEventListener("click", () => void decode());

  getElement<HTMLButtonElement>("load-example").addEventListener("click", () => {
    markdownInput.value = SAMPLE_MARKDOWN;
    fileName.textContent = "Zachowujemy nagłówki, akapity i listy";
    if (restoreFromCache(SAMPLE_MARKDOWN)) return;
    showDocument(SAMPLE_DECODED_DOCUMENT, SAMPLE_MARKDOWN);
    status.textContent = "Wczytano gotową próbkę — przykładowe dane, bez wysyłania tekstu do Gemini.";
  });

  getElement<HTMLButtonElement>("clear-input").addEventListener("click", () => {
    speech.stop();
    markdownInput.value = "";
    fileName.textContent = "Zachowujemy nagłówki, akapity i listy";
    currentData = null;
    revealedTokens.clear();
    workspace.classList.add("hidden");
    reader.replaceChildren();
    status.textContent = "";
    markdownInput.focus();
  });

  const fileInput = getElement<HTMLInputElement>("file-input");
  const fileName = getElement<HTMLElement>("file-name");
  const dropzone = getElement<HTMLElement>("dropzone");
  const loadFile = async (file: File) => {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      status.textContent = "Wybierz plik z rozszerzeniem .md, .markdown lub .txt.";
      return;
    }
    if (file.size > 20_000) {
      status.textContent = "Plik może mieć maksymalnie 20 000 bajtów.";
      return;
    }
    try {
      markdownInput.value = await file.text();
      fileName.textContent = `Wczytano: ${file.name}`;
      status.textContent = "Plik wczytany. Sprawdź treść przed wysłaniem do AI.";
    } catch {
      status.textContent = "Nie udało się odczytać pliku. Spróbuj zapisać go jako UTF-8.";
    }
  };

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("border-teal-600", "bg-teal-50", "dark:bg-teal-950");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-teal-600", "bg-teal-50", "dark:bg-teal-950");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("border-teal-600", "bg-teal-50", "dark:bg-teal-950");
    const file = event.dataTransfer?.files[0];
    if (file) void loadFile(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) void loadFile(file);
    fileInput.value = "";
  });

  getElement<HTMLButtonElement>("theme-toggle").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("birkenbihl-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
  });
  getElement<HTMLButtonElement>("guide-toggle").addEventListener("click", () => {
    const panel = getElement<HTMLElement>("guide-panel");
    panel.classList.toggle("hidden");
    getElement<HTMLButtonElement>("guide-toggle").setAttribute("aria-expanded", String(!panel.classList.contains("hidden")));
    getElement<HTMLElement>("guide-chevron").classList.toggle("rotate-180", !panel.classList.contains("hidden"));
  });

  document.querySelectorAll<HTMLButtonElement>(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedMode = button.dataset.mode;
      if (selectedMode !== "decode" && selectedMode !== "listen" && selectedMode !== "test") {
        status.textContent = "Nieznany tryb nauki.";
        return;
      }
      speech.stop();
      currentMode = selectedMode;
      document.querySelectorAll(".mode-button").forEach((item) => {
        item.classList.remove("bg-white", "dark:bg-slate-700", "text-teal-700", "dark:text-teal-300", "shadow-sm");
        item.classList.add("text-slate-600", "dark:text-slate-300");
        item.setAttribute("aria-pressed", "false");
      });
      button.classList.add("bg-white", "dark:bg-slate-700", "text-teal-700", "dark:text-teal-300", "shadow-sm");
      button.classList.remove("text-slate-600", "dark:text-slate-300");
      button.setAttribute("aria-pressed", "true");
      render();
    });
  });

  naturalToggle.addEventListener("change", () => {
    showNatural = naturalToggle.checked;
    reader.querySelectorAll<HTMLElement>(".natural-translation").forEach((element) => {
      element.hidden = !showNatural;
    });
  });

  playAllButton.addEventListener("click", () => {
    if (playAllButton.getAttribute("aria-pressed") === "true") {
      speech.stop();
      return;
    }
    const sentences = Array.from(reader.querySelectorAll<HTMLElement>(".decoded-sentence")).flatMap((element) => {
      const sentence = currentData?.blocks
        .flatMap((block) => block.sentences)
        .find((item) => item.id === element.dataset.sentenceId);
      return sentence ? [{ sentence, element }] : [];
    });
    void speech.playAll(sentences);
  });

  getElement<HTMLButtonElement>("export-md").addEventListener("click", () => {
    if (!currentData) return;
    downloadFile(createMarkdownExport(currentData), "dekodowanie-birkenbihl.md", "text/markdown;charset=utf-8");
  });
  getElement<HTMLButtonElement>("export-html").addEventListener("click", () => {
    if (!currentData) return;
    downloadFile(createStandaloneHtml(currentData), "arkusz-birkenbihl-offline.html", "text/html;charset=utf-8");
  });
}
