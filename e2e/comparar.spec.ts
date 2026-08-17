import { expect, test, type Page } from "@playwright/test";

// Marca los dos primeros cursos y espera a estar de verdad en la comparación.
//
// Esa espera no es adorno. Lecturas como `count()`, `allTextContents()` o
// `page.url()` no reintentan: devuelven lo que haya en ese instante. Si se usan
// justo después del clic, leen todavía /buscar —cero filas, cero títulos— y el
// test falla culpando al comparador de algo que no ha hecho. Con el servidor de
// desarrollo compilando /comparar por primera vez y varios workers a la vez, esa
// carrera se pierde de forma sistemática.
async function compararDosPrimeros(page: Page) {
  await page.goto("/buscar");

  const casillas = page.locator('input[name="ids"]');
  await casillas.nth(0).check();
  await casillas.nth(1).check();
  await page.getByRole("button", { name: "Comparar seleccionados" }).click();

  await expect(page).toHaveURL(/\/comparar\?ids=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comparar cursos");
}

test.describe("HU-017 — comparador", () => {
  test("seleccionar cursos en el buscador lleva a la comparación", async ({ page }) => {
    await compararDosPrimeros(page);

    // Dos cursos comparados: dos columnas además de la de etiquetas.
    const cabeceras = page.locator("thead th");
    await expect(cabeceras).toHaveCount(3);
  });

  test("los mismos campos se muestran para todos los cursos", async ({ page }) => {
    await compararDosPrimeros(page);

    // Cada fila tiene una celda por curso, que es lo que permite leerla en vertical.
    const filas = page.locator("tbody tr");
    const total = await filas.count();
    expect(total).toBeGreaterThan(3);

    for (let i = 0; i < total; i++) {
      await expect(filas.nth(i).locator("td")).toHaveCount(2);
    }

    await expect(page.getByRole("rowheader", { name: "Plataforma" })).toBeVisible();
  });

  test("la comparación se puede compartir por enlace", async ({ page, context }) => {
    await compararDosPrimeros(page);

    const url = page.url();
    const titulos = await page.locator("thead th a").allTextContents();

    // Abrir el mismo enlace en otra pestaña reproduce la misma comparación.
    const otra = await context.newPage();
    await otra.goto(url);
    expect(await otra.locator("thead th a").allTextContents()).toEqual(titulos);
    await otra.close();
  });

  test("seleccionar un solo curso explica que hacen falta al menos dos", async ({ page }) => {
    await page.goto("/buscar");
    await page.locator('input[name="ids"]').first().check();
    await page.getByRole("button", { name: "Comparar seleccionados" }).click();

    await expect(page.getByRole("status")).toContainText(/al menos un curso más/i);
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("sin selección alguna se explica qué hacer, sin errores", async ({ page }) => {
    await page.goto("/comparar");

    await expect(page.getByRole("status")).toContainText(/marca al menos dos/i);
  });

  // Un enlace compartido con un curso retirado debe seguir siendo útil.
  test("los identificadores inválidos se ignoran y se comparan los válidos", async ({ page }) => {
    await compararDosPrimeros(page);

    const url = new URL(page.url());
    url.searchParams.append("ids", "no-soy-un-uuid");
    url.searchParams.append("ids", "00000000-0000-4000-8000-000000000000");

    await page.goto(url.toString());
    await expect(page.locator("thead th")).toHaveCount(3);
  });

  test("desde la comparación se puede ir a la ficha y a la plataforma", async ({ page }) => {
    await compararDosPrimeros(page);

    const salida = page.getByRole("link", { name: /^Ver en /i }).first();
    await expect(salida).toBeVisible();
    expect(await salida.getAttribute("href")).toMatch(/^https:\/\//);
    expect(await salida.getAttribute("rel")).toContain("noopener");

    await expect(page.getByText(/enlaces de salida pueden ser de afiliado/i)).toBeVisible();

    await page.locator("thead th a").first().click();
    await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
  });
});
