import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-047, menos uno: que los cursos sin
// duración publicada queden al final se prueba en integración
// (`tests/integration/orden.test.ts`). Por el navegador no se puede comprobar
// de verdad — 7.197 de los 9.380 cursos tienen duración, así que los huecos no
// aparecen hasta pasada la página 140, y un test que dependa de eso sería
// frágil y lentísimo.

// La línea de datos de cada curso es el primer <p> de su tarjeta (mismo
// criterio que orden.spec.ts, HU-027).
const metas = (page: Page) => page.locator("main li p:first-of-type");

async function lineas(page: Page): Promise<string[]> {
  return (await metas(page).allTextContents()).map((t) => t.trim());
}

// «44 min», «2,5 h», «65 h» o «12 h–20 h» → minutos. De un rango se toma el
// extremo bajo, que es por donde ordena la consulta.
function duracionDe(linea: string): number | null {
  const m = /⏱\s*([\d.,]+)\s*(min|h)/.exec(linea);
  if (!m) return null;
  const cantidad = Number(m[1].replace(",", "."));
  return m[2] === "h" ? Math.round(cantidad * 60) : cantidad;
}

// Los nulos solo pueden ir después del último valor, nunca entre medias.
function vaOrdenada(valores: Array<number | null>): boolean {
  let ultimo: number | null = null;
  let yaHuboNulo = false;

  for (const valor of valores) {
    if (valor === null) {
      yaHuboNulo = true;
      continue;
    }
    if (yaHuboNulo) return false;
    if (ultimo !== null && ultimo > valor) return false;
    ultimo = valor;
  }
  return true;
}

test.describe("HU-047 — ordenar por duración", () => {
  test("el desplegable ofrece ordenar por duración, además de lo que ya había", async ({
    page,
  }) => {
    await page.goto("/buscar");

    const selector = page.getByLabel("Ordenar por");
    await expect(selector.locator("option")).toContainText([
      "Mezcla equilibrada",
      "Precio: de menor a mayor",
      "Mejor valorados",
      "Duración: de menor a mayor",
    ]);
  });

  test("las duraciones no bajan según se baja por la lista", async ({ page }) => {
    await page.goto("/buscar");
    await page.getByLabel("Ordenar por").selectOption("duracion-asc");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    // waitForURL y no toHaveURL: este espera también al load, y sin eso la
    // lista se lee a medias (misma cautela que en orden.spec.ts).
    await page.waitForURL(/orden=duracion-asc/);

    const duraciones = (await lineas(page)).map(duracionDe);
    expect(duraciones.filter((d) => d !== null).length).toBeGreaterThan(1);
    expect(vaOrdenada(duraciones)).toBe(true);
  });

  test("el orden se mantiene al pasar de página, también en la costura", async ({ page }) => {
    await page.goto("/buscar?orden=duracion-asc");
    const primera = (await lineas(page)).map(duracionDe);

    await page.getByRole("link", { name: "Siguiente" }).click();
    await page.waitForURL(/pagina=2/);
    expect(page.url()).toContain("orden=duracion-asc");

    const segunda = (await lineas(page)).map(duracionDe);

    // Lo que importa es la costura: cada página puede ir ordenada por dentro y
    // aun así el primero de la segunda ser más corto que el último de la primera.
    expect(vaOrdenada([...primera, ...segunda])).toBe(true);
  });

  test("la dirección con este orden se puede compartir", async ({ page }) => {
    await page.goto("/buscar?orden=duracion-asc");
    const esperados = await lineas(page);

    await page.goto("/buscar?orden=duracion-asc");

    await expect(page.getByLabel("Ordenar por")).toHaveValue("duracion-asc");
    expect(await lineas(page)).toEqual(esperados);
  });

  test("siguen apareciendo las dos plataformas, no solo una", async ({ page }) => {
    // A diferencia del orden por precio —que en la práctica es un orden de
    // Udemy, porque Coursera no publica precios—, aquí las dos publican
    // duración y las dos tienen que poder salir. Se mira en varias páginas: el
    // reparto no tiene por qué darse en las primeras 50 filas.
    const fuentes = new Set<string>();
    for (const pagina of [1, 2, 3]) {
      await page.goto(`/buscar?orden=duracion-asc&pagina=${pagina}`);
      for (const linea of await lineas(page)) fuentes.add(linea.split(" ")[0].toLowerCase());
    }

    expect([...fuentes].sort()).toEqual(["coursera", "udemy"]);
  });
});
