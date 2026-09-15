import { expect, test } from "@playwright/test";

// HU-051. El criterio que se prueba en la suite normal: sin identificador de
// Google Analytics (el caso de local y de estos tests), no aparece el aviso ni
// se pide nada a Google. Es lo que evita mandar tráfico falso a la propiedad
// real. Los criterios con la analítica configurada están en e2e-analitica/.

test.describe("HU-051 — sin analítica configurada", () => {
  test("en local y en los tests no hay aviso ni peticiones a Google", async ({ page }) => {
    const pedidas: string[] = [];
    page.on("request", (peticion) => {
      if (/googletagmanager\.com|google-analytics\.com/.test(peticion.url())) {
        pedidas.push(peticion.url());
      }
    });

    for (const ruta of ["/", "/buscar", "/privacidad"]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await page.waitForTimeout(1000);

    await expect(page.getByRole("dialog").filter({ hasText: /Google Analytics/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Configurar cookies" })).toHaveCount(0);
    expect(pedidas).toEqual([]);
  });
});
