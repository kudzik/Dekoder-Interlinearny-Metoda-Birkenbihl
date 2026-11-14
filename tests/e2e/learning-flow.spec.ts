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
  const token = page.locator('#reader .token[data-token-key="1-1-0"]');
  await expect(token).toHaveAttribute("aria-label", "I: glosa ukryta");
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

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksport HTML offline" }).click();
  const htmlDownload = await htmlDownloadPromise;
  expect(htmlDownload.suggestedFilename()).toBe("arkusz-birkenbihl-offline.html");

  await page.reload();
  await expect(page.locator("#markdown-input")).toHaveValue(markdown);
  await expect(page.locator("#workspace")).toBeVisible();
  expect(decodeRequests).toBe(1);
});

test("keeps the learning interface usable at phone, tablet, and desktop widths", async ({ page }) => {
  await page.goto("/");

  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("#workspace")).toBeVisible();
    await expect(page.locator("#decode-button")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
      dimensions.clientWidth,
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Jak się uczyć?" }).click();
  await expect(page.locator("#guide-panel")).toBeVisible();
  await page.getByRole("button", { name: "Zmień motyw" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByText("Pokaż naturalne tłumaczenie zdań").click();
  await expect(page.locator("#reader .natural-translation").first()).toBeVisible();
  await page.getByRole("button", { name: "Eksport Markdown" }).focus();
  await expect(page.getByRole("button", { name: "Eksport Markdown" })).toBeFocused();
});

test("aligns playback controls and keeps grammar popovers inside a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto("/");

  const firstBlock = page.locator("#reader .decoded-block").first();
  const blockPlay = firstBlock.locator(".play-block-button");
  const sentencePlay = firstBlock.locator(".play-audio-button:not(.play-block-button)").first();
  const [blockBox, sentenceBox] = await Promise.all([blockPlay.boundingBox(), sentencePlay.boundingBox()]);
  if (!blockBox || !sentenceBox) throw new Error("Playback controls should be visible");
  expect(Math.abs(blockBox.y - sentenceBox.y)).toBeLessThan(1);
  expect(sentenceBox.x - (blockBox.x + blockBox.width)).toBeGreaterThanOrEqual(0);
  expect(sentenceBox.x - (blockBox.x + blockBox.width)).toBeLessThanOrEqual(8);

  const secondBlock = page.locator("#reader .decoded-block").nth(1);
  const secondSentence = secondBlock.locator(".decoded-sentence").nth(1);
  const [sentenceButtonBox, sentenceTextBox] = await Promise.all([
    secondSentence.locator(".play-audio-button").boundingBox(),
    secondSentence.locator(".sentence-text").boundingBox(),
  ]);
  if (!sentenceButtonBox || !sentenceTextBox) throw new Error("Sentence playback should sit beside its text");
  expect(Math.abs(sentenceButtonBox.y - sentenceTextBox.y)).toBeLessThan(12);
  expect(sentenceTextBox.x - sentenceButtonBox.x - sentenceButtonBox.width).toBeGreaterThanOrEqual(0);
  expect(sentenceTextBox.x - sentenceButtonBox.x - sentenceButtonBox.width).toBeLessThanOrEqual(8);

  const chunk = page.locator("#reader .token-chunk").filter({ hasText: "used to" }).first();
  await chunk.scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await chunk.dispatchEvent("mouseenter");
  const popover = await page.locator("#grammar-popover").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      hidden: (element as HTMLElement).hidden,
      badge: element.querySelector(".grammar-popover-badge")?.textContent,
      gloss: element.querySelector(".grammar-popover-gloss")?.textContent,
      x: rect.x,
      y: rect.y,
      right: rect.right,
      bottom: rect.bottom,
    };
  });
  expect(popover.hidden).toBe(false);
  expect(popover.badge).toBe("Zbitka / idiom");
  expect(popover.gloss).toContain("Dosłownie:");
  expect(popover.x).toBeGreaterThanOrEqual(0);
  expect(popover.y).toBeGreaterThanOrEqual(0);
  expect(popover.right).toBeLessThanOrEqual(320);
  expect(popover.bottom).toBeLessThanOrEqual(680);
});

test("sends selected Gemini speech settings and reports failures beside the reader", async ({ page }) => {
  let speechRequest: { text: string; accent: string } | undefined;
  await page.route("**/api/speech", async (route) => {
    speechRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "rate_limited", message: "Limit testowy Gemini TTS." } }),
    });
  });

  await page.goto("/");
  await page.locator("#voice-select").selectOption("gemini:en-US");
  await page.locator("#rate-select").selectOption("0.8");
  await page.locator("#reader .token").first().click();

  await expect(page.locator("#speech-status")).toHaveText("Limit testowy Gemini TTS.");
  await expect(page.locator("#status-message")).not.toContainText("Limit testowy");
  expect(speechRequest).toEqual({ text: "A", accent: "en-US" });
});

test.describe("mobile touch controls", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("reveals hidden glosses with a tap, without relying on hover", async ({ page }) => {
    await page.route("**/api/speech", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "rate_limited", message: "TTS mock." } }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test / Ukryj tłumaczenie" }).tap();
    const token = page.locator('#reader .token[data-token-key="1-1-0"]');
    await expect(token).toHaveAttribute("aria-label", "A: glosa ukryta");
    await token.tap();
    await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 1");
    await expect(token).toHaveAttribute("aria-label", /A: \(przedimek\)/);
  });
});
