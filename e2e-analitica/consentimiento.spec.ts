import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-051 que necesita la analítica
// configurada. El servidor arranca con un identificador de prueba
// (playwright.analitica.config.ts).
//
// Todas las peticiones a Google se interceptan y se responden en local: se
// registran para comprobar cuándo se piden, pero nunca llegan a Google.

const GOOGLE = /googletagmanager\.com|google-analytics\.com/;

async function espiarGoogle(page: Page): Promise<string[]> {
  const pedidas: string[] = [];
  await page.route(GOOGLE, async (ruta) => {
    pedidas.push(ruta.request().url());
    await ruta.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  return pedidas;
}

const aviso = (page: Page) => page.getByRole("dialog").filter({ hasText: /Google Analytics/ });

test.describe("HU-051 — analítica solo con consentimiento", () => {
  test("en la primera visita se pregunta, con Aceptar y Rechazar iguales, y no se carga nada de Google", async ({
    page,
  }) => {
    const pedidas = await espiarGoogle(page);
    await page.goto("/");

    await expect(aviso(page)).toBeVisible();
    const rechazar = aviso(page).getByRole("button", { name: "Rechazar" });
    const aceptar = aviso(page).getByRole("button", { name: "Aceptar" });
    await expect(rechazar).toBeVisible();
    await expect(aceptar).toBeVisible();

    // Mismo aspecto: rechazar no puede ser un enlace gris al lado de un botón
    // destacado. Se compara el estilo calculado, no solo que existan.
    const estilo = (boton: typeof rechazar) =>
      boton.evaluate((b) => {
        const c = getComputedStyle(b);
        return [c.backgroundColor, c.color, c.fontSize, c.fontWeight, c.borderColor, c.height];
      });
    expect(await estilo(rechazar)).toEqual(await estilo(aceptar));

    await page.waitForTimeout(1500);
    expect(pedidas).toEqual([]);
  });

  test("al rechazar, desaparece el aviso, no se carga Google y no se vuelve a preguntar", async ({
    page,
  }) => {
    const pedidas = await espiarGoogle(page);
    await page.goto("/");
    await aviso(page).getByRole("button", { name: "Rechazar" }).click();

    await expect(aviso(page)).toHaveCount(0);

    await page.goto("/buscar");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(aviso(page)).toHaveCount(0);
    expect(pedidas).toEqual([]);
  });

  test("al aceptar, se carga Google Analytics, y en las siguientes visitas sin volver a preguntar", async ({
    page,
  }) => {
    const pedidas = await espiarGoogle(page);
    await page.goto("/");
    await aviso(page).getByRole("button", { name: "Aceptar" }).click();

    await expect.poll(() => pedidas.some((u) => u.includes("gtag/js?id=G-PRUEBA0000"))).toBe(true);
    await expect(aviso(page)).toHaveCount(0);

    pedidas.length = 0;
    await page.goto("/privacidad");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
    await expect.poll(() => pedidas.some((u) => u.includes("gtag/js"))).toBe(true);
  });

  test("desde el pie se puede cambiar de opinión, y retirar el consentimiento deja de cargar Google", async ({
    page,
  }) => {
    const pedidas = await espiarGoogle(page);
    await page.goto("/");
    await aviso(page).getByRole("button", { name: "Aceptar" }).click();
    await expect.poll(() => pedidas.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Configurar cookies" }).click();
    await expect(aviso(page)).toBeVisible();
    await aviso(page).getByRole("button", { name: "Rechazar" }).click();

    pedidas.length = 0;
    await page.goto("/buscar");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(pedidas).toEqual([]);
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("no se carga ninguna analítica y la web funciona igual", async ({ page }) => {
      const pedidas = await espiarGoogle(page);
      await page.goto("/buscar");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
      await expect(page.locator("main li h2 a").first()).toBeVisible();
      expect(pedidas).toEqual([]);
    });
  });
});
