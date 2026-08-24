import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-027.
//
// La línea de datos de cada curso es el primer <p> de su ficha en la lista; el
// segundo, si lo hay, es la descripción. De ahí se leen precio y valoración.

const metas = (page: Page) => page.locator("main li p:first-of-type");

async function lineas(page: Page): Promise<string[]> {
  return (await metas(page).allTextContents()).map((t) => t.trim());
}

function precioDe(linea: string): number | null {
  const m = /·\s*([\d.]+)\s+[A-Z]{3}/.exec(linea);
  return m ? Number(m[1]) : null;
}

function valoracionDe(linea: string): number | null {
  const m = /⭐\s*([\d.]+)/.exec(linea);
  return m ? Number(m[1]) : null;
}

// Los nulos solo pueden ir después del último valor, nunca entre medias.
function vaOrdenada(
  valores: Array<number | null>,
  comparar: (anterior: number, actual: number) => boolean
): boolean {
  let ultimo: number | null = null;
  let yaHuboNulo = false;

  for (const valor of valores) {
    if (valor === null) {
      yaHuboNulo = true;
      continue;
    }
    if (yaHuboNulo) return false;
    if (ultimo !== null && !comparar(ultimo, valor)) return false;
    ultimo = valor;
  }
  return true;
}

test.describe("HU-027 — ordenar los resultados", () => {
  test("el buscador ofrece elegir el orden", async ({ page }) => {
    await page.goto("/buscar");

    const selector = page.getByLabel("Ordenar por");
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue("");
    await expect(selector.locator("option")).toContainText([
      "Mezcla equilibrada",
      "Precio: de menor a mayor",
      "Mejor valorados",
    ]);
  });

  test("por precio, los precios no bajan según se baja por la lista", async ({ page }) => {
    await page.goto("/buscar");
    await page.getByLabel("Ordenar por").selectOption("precio-asc");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/orden=precio-asc/);

    const precios = (await lineas(page)).map(precioDe);
    expect(precios.filter((p) => p !== null).length).toBeGreaterThan(1);
    expect(vaOrdenada(precios, (a, b) => a <= b)).toBe(true);
  });

  test("por valoración, las valoraciones no suben según se baja por la lista", async ({
    page,
  }) => {
    await page.goto("/buscar?orden=valoracion-desc");

    const valoraciones = (await lineas(page)).map(valoracionDe);
    expect(valoraciones.filter((v) => v !== null).length).toBeGreaterThan(1);
    expect(vaOrdenada(valoraciones, (a, b) => a >= b)).toBe(true);
  });

  test("el orden se mantiene al pasar de página, también en la costura", async ({ page }) => {
    await page.goto("/buscar?orden=precio-asc");
    const primera = (await lineas(page)).map(precioDe);

    await page.getByRole("link", { name: "Siguiente" }).click();
    await page.waitForURL(/pagina=2/);
    expect(page.url()).toContain("orden=precio-asc");

    const segunda = (await lineas(page)).map(precioDe);

    // Cada página puede estar ordenada por dentro y aun así el primero de la
    // segunda ser más barato que el último de la primera: eso es lo que se mira.
    expect(vaOrdenada([...primera, ...segunda], (a, b) => a <= b)).toBe(true);
  });

  test("la dirección con orden se puede compartir", async ({ page }) => {
    await page.goto("/buscar");
    await page.getByLabel("Ordenar por").selectOption("valoracion-desc");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/orden=valoracion-desc/);

    const direccion = page.url();
    const esperados = await lineas(page);

    await page.goto(direccion);

    await expect(page.getByLabel("Ordenar por")).toHaveValue("valoracion-desc");
    expect(await lineas(page)).toEqual(esperados);
  });

  test("un orden inventado enseña resultados con el orden por defecto", async ({ page }) => {
    await page.goto("/buscar?orden=lo-que-sea");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
    await expect(page.locator("main li h2 a").first()).toBeVisible();
    // El selector no se queda con la basura: enseña el de por defecto.
    await expect(page.getByLabel("Ordenar por")).toHaveValue("");
  });

  test("con el orden por defecto siguen apareciendo las dos plataformas", async ({ page }) => {
    await page.goto("/buscar");

    const fuentes = (await lineas(page)).map((l) => l.split(" ")[0].toLowerCase());
    expect(fuentes).toContain("udemy");
    expect(fuentes).toContain("coursera");
  });
});
