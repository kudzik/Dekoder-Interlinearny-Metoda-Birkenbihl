import { expect, test } from "@playwright/test";

const markdown = "I am ready.";
const decoded = {
  blocks: [
    {
      type: "paragraph",
      sentences: [
        {
          id: "1-1",
          natural_pl: "Jestem gotowy.",
          tokens: [
            { en: "I", pl_literal: "Ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "am ready.", pl_literal: "jestem gotowy.", is_chunk: false },
          ],
        },
      ],
    },
  ],
};

test("decodes a text, reveals a gloss, exports, and restores the cached lesson", async ({ page }) => {
  let decodeRequests = 0;
  let speechRequests = 0;
  await page.addInitScript(() => {
    const voice = {
      voiceURI: "test-en-US",
      name: "Test English",
      lang: "en-US",
      default: false,
      localService: true,
    };
    class FakeUtterance {
      voice: unknown = null;
      lang = "";
      rate = 1;
      onboundary: ((event: { name: string; charIndex: number }) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;

      constructor(public text: string) {}
    }

    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FakeUtterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [voice],
        addEventListener: () => {},
        cancel: () => {},
        speak: (utterance: FakeUtterance) => {
          (window as Window & { spokenText?: string }).spokenText = utterance.text;
          window.setTimeout(() => {
            utterance.onboundary?.({ name: "word", charIndex: 0 });
            utterance.onend?.();
          }, 0);
        },
      },
    });
  });
  await page.route("**/api/decode", async (route) => {
    decodeRequests += 1;
    await route.fulfill({ json: decoded });
  });
  await page.route("**/api/speech", async (route) => {
    speechRequests += 1;
    await route.fulfill({ status: 500 });
  });

  await page.goto("/");
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(page.locator("#status-message")).toContainText("bez wysyłania tekstu do Gemini");
  await expect(page.locator("#voice-select option[value='system:test-en-US']")).toHaveCount(1);
  await page.locator("#voice-select").selectOption("system:test-en-US");
  await page.getByRole("button", { name: "Odtwórz fragment" }).nth(1).click();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { spokenText?: string }).spokenText))
    .toBe(
      "For years, I used to put off waking up early. Whenever my alarm went off, I would hit the snooze button and stay in bed.",
    );
  await page.locator("#file-input").setInputFiles({
    name: "lesson.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
  await expect(page.locator("#markdown-input")).toHaveValue(markdown);
  await page.getByRole("button", { name: "Dekoduj tekst (AI)" }).click();
  await expect(page.locator("#reader .token-en").first()).toHaveText("I");
  await expect(page.getByRole("button", { name: "Odtwórz fragment" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Test / Ukryj tłumaczenie" }).click();
  await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 0");
  const token = page.getByRole("button", { name: /I: Ja/ });
  await token.hover();
  await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 1");
  await token.click();
  await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 1");
  await expect.poll(() => page.evaluate(() => (window as Window & { spokenText?: string }).spokenText)).toBe("I");
  expect(speechRequests).toBe(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksport Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("dekodowanie-birkenbihl.md");

  await page.reload();
  await expect(page.locator("#markdown-input")).toHaveValue(markdown);
  await expect(page.locator("#workspace")).toBeVisible();
  expect(decodeRequests).toBe(1);
});
