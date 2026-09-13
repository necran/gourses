import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-048.

const metas = (page: Page) => page.locator("main li p:first-of-type");

async function lineas(page: Page): Promise<string[]> {
  return (await metas(page).allTextContents()).map((t) => t.trim());
}

// «44 min», «2,5 h» o «12 h–20 h» → minutos del **extremo alto**, que es por
// donde filtra un techo de duración: un curso de «1 h–20 h» no cumple «como
// mucho 2 horas».
function duracionMaximaDe(linea: string): number | null {
  const encontrados = [...linea.matchAll(/([\d.,]+)\s*(min|h)\b/g)];
  if (encontrados.length === 0) return null;
  const ultimo = encontrados[encontrados.length - 1];
  const cantidad = Number(ultimo[1].replace(",", "."));
  return ultimo[2] === "h" ? Math.round(cantidad * 60) : cantidad;
}

const aviso = (page: Page) => page.getByRole("status").filter({ hasText: /quedan fuera/i });

test.describe("HU-048 — filtrar por duración máxima", () => {
  test("el buscador ofrece pedir una duración máxima", async ({ page }) => {
    await page.goto("/buscar");

    await expect(page.getByLabel("Duración máxima")).toBeVisible();
  });

  test("todos los resultados duran eso o menos", async ({ page }) => {
    await page.goto("/buscar");
    await page.getByLabel("Duración máxima").fill("2");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.waitForURL(/maxDuration=2/);

    const duraciones = (await lineas(page)).map(duracionMaximaDe);
    expect(duraciones.length).toBeGreaterThan(0);
    for (const minutos of duraciones) {
      expect(minutos).not.toBeNull();
      expect(minutos!).toBeLessThanOrEqual(120);
    }
  });

  test("avisa de que los cursos sin duración quedan fuera, y de cómo incluirlos", async ({
    page,
  }) => {
    await page.goto("/buscar?maxDuration=2");

    await expect(aviso(page)).toContainText(/duraci[óo]n/i);
    await expect(aviso(page).getByRole("link", { name: /Incluirlos de todos modos/i })).toBeVisible();

    // Y no dice de más: la frase de que Coursera se queda fuera entera es
    // cierta del precio y la valoración, pero no de la duración, que sí
    // publica en casi la mitad de sus cursos. Se coló en la primera versión.
    await expect(aviso(page)).not.toContainText(/cat[áa]logo entero/i);

    await page.goto("/buscar?maxPrice=20");
    await expect(aviso(page)).toContainText(/cat[áa]logo entero/i);
  });

  test("al incluirlos, vuelven los cursos que no publican duración", async ({ page }) => {
    await page.goto("/buscar?maxDuration=2");
    const conFiltro = await lineas(page);
    expect(conFiltro.every((l) => duracionMaximaDe(l) !== null)).toBe(true);

    await page.getByRole("link", { name: /Incluirlos de todos modos/i }).click();
    await page.waitForURL(/sinDato=1/);

    const conHuecos = await lineas(page);
    expect(conHuecos.some((l) => duracionMaximaDe(l) === null)).toBe(true);
    // Y los que sí la publican siguen cumpliendo el techo: incluir los huecos
    // no puede convertirse en «no filtrar».
    for (const linea of conHuecos) {
      const minutos = duracionMaximaDe(linea);
      if (minutos !== null) expect(minutos).toBeLessThanOrEqual(120);
    }
  });

  test("el filtro sobrevive a pasar de página y a cambiar el orden", async ({ page }) => {
    await page.goto("/buscar?maxDuration=3&orden=duracion-asc");

    await page.getByRole("link", { name: "Siguiente" }).click();
    await page.waitForURL(/pagina=2/);

    expect(page.url()).toContain("maxDuration=3");
    expect(page.url()).toContain("orden=duracion-asc");
    for (const linea of await lineas(page)) {
      expect(duracionMaximaDe(linea)!).toBeLessThanOrEqual(180);
    }
  });

  test("la dirección con el filtro se puede compartir", async ({ page, context }) => {
    await page.goto("/buscar?maxDuration=1");
    const esperados = await lineas(page);

    const otra = await context.newPage();
    await otra.goto("/buscar?maxDuration=1");

    await expect(otra.getByLabel("Duración máxima")).toHaveValue("1");
    expect(await lineas(otra)).toEqual(esperados);
    await otra.close();
  });

  test("una duración inventada en la dirección no rompe la búsqueda", async ({ page }) => {
    // Un bucle y no `test.each`: eso es de Vitest, Playwright no lo tiene.
    for (const valor of ["abc", "-3", "999999999", "", "NaN"]) {
      await page.goto(`/buscar?maxDuration=${valor}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
      await expect(page.locator("main li h2 a").first()).toBeVisible();
    }
  });
});
