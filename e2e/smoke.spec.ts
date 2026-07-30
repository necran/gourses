import { expect, test } from "@playwright/test";

test("la home carga en local", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "To get started, edit the page.tsx file." })).toBeVisible();
});
