import { expect, test } from "@playwright/test";

// Comprobación mínima de que el sitio levanta. El contenido de la portada lo
// verifica e2e/portada.spec.ts (HU-012); antes este test esperaba el andamio
// de create-next-app, que ya no existe.
test("la home carga en local", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
