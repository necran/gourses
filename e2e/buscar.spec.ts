import { expect, test } from "@playwright/test";

test.describe("HU-007 — buscador de cursos", () => {
  test("la carga inicial sin filtros muestra un listado por defecto", async ({ page }) => {
    await page.goto("/buscar");

    await expect(page.getByRole("heading", { level: 1, name: "Buscar cursos" })).toBeVisible();
    await expect(page.locator("main li")).not.toHaveCount(0);
  });

  test("buscar por palabra clave muestra cursos cuyo título o descripción coincide", async ({
    page,
  }) => {
    await page.goto("/buscar");

    await page.getByLabel("Palabra clave").fill("python");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/keyword=python/);
    const items = page.locator("main li");
    await expect(items.first()).toBeVisible();

    const text = (await items.allTextContents()).join(" ").toLowerCase();
    expect(text).toContain("python");
  });

  test("aplicar un filtro de precio máximo actualiza la lista respetando el límite", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const sinFiltrar = await page.locator("main li h2").allTextContents();

    await page.getByLabel("Precio máximo").fill("20");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/maxPrice=20/);

    // La lista cambia respecto a la no filtrada (no se compara el número de
    // resultados: con catálogo grande ambas pueden llegar al límite de página).
    const filtrados = await page.locator("main li h2").allTextContents();
    expect(filtrados).not.toEqual(sinFiltrar);

    // Y lo que exige el criterio: ningún curso mostrado supera el precio.
    const metaTexts = await page.locator("main li p").allTextContents();
    const precios = metaTexts
      .map((line) => line.match(/·\s*([\d.]+)\s+[A-Z]{3}/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));

    expect(precios.length).toBeGreaterThan(0);
    for (const precio of precios) {
      expect(precio).toBeLessThanOrEqual(20);
    }
  });

  // Criterio de HU-006 (y razón de ser del esquema común de HU-004): hasta que
  // no hubo datos de Udemy (HU-005) no se pudo comprobar de verdad.
  test("los cursos de Udemy y Coursera aparecen mezclados con la misma estructura", async ({
    page,
  }) => {
    await page.goto("/buscar");

    const fuentes = await page.locator("main li p").allTextContents();
    const texto = fuentes.join(" ");

    expect(texto).toContain("udemy");
    expect(texto).toContain("coursera");
  });

  test("una búsqueda sin resultados muestra un mensaje claro, nunca una lista vacía sin explicación", async ({
    page,
  }) => {
    await page.goto("/buscar");

    await page.getByLabel("Palabra clave").fill("zzz-no-existe-ningun-curso-asi-nunca-jamas");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "No se han encontrado cursos con esos criterios."
    );
    await expect(page.locator("main li")).toHaveCount(0);
  });
});
