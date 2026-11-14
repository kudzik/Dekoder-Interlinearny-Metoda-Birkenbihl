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
  await page.route("**/api/decode", async (route) => {
    decodeRequests += 1;
    await route.fulfill({ json: decoded });
  });

  await page.goto("/");
  await page.locator("#file-input").setInputFiles({
    name: "lesson.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
  await expect(page.locator("#markdown-input")).toHaveValue(markdown);
  await page.getByRole("button", { name: "Dekoduj tekst (AI)" }).click();
  await expect(page.locator("#reader .token-en").first()).toHaveText("I");

  await page.getByRole("button", { name: "Test / Active Recall" }).click();
  await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 0");
  const token = page.getByRole("button", { name: /I: Ja/ });
  await token.hover();
  await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 1");
  await token.click();
  await expect(page.locator("#test-counter")).toHaveText("Odkryte słowa: 1");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksport Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("dekodowanie-birkenbihl.md");

  await page.reload();
  await expect(page.locator("#markdown-input")).toHaveValue(markdown);
  await expect(page.locator("#workspace")).toBeVisible();
  expect(decodeRequests).toBe(1);
});
