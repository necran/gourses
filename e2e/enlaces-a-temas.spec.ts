import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-060 que se puede comprobar con los
// datos reales. «Un tema que baja del umbral no se enlaza» no: en la base de
// desarrollo los 28 temas lo superan (igual que en HU-058). Esa decisión la
// prueban los unitarios de temasEnlazables y temasDeCategoria.

async function destinos(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(`${selector} a[href^="/cursos/"]`)
    .evaluateAll((enlaces) => [...new Set(enlaces.map((a) => a.getAttribute("href")!))]);
}

async function temasDelSitemap(page: Page): Promise<string[]> {
  const xml = await (await page.request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>[^<]*(\/cursos\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1]).sort();
}

test.describe("HU-060 — enlaces a las páginas de tema", () => {
  // Desde HU-070 la portada enseña solo unos pocos temas, así que la garantía de
  // HU-060 —que todos los que superan el umbral tienen enlace en el sitio, y no
  // solo en el sitemap— la cumple ahora el índice. Se comprueba el recorrido
  // entero, que es lo que de verdad importa.
  test("los temas que superan el umbral se alcanzan desde la portada, por el índice", async ({ page }) => {
    await page.goto("/");
    const seccion = page.getByRole("region", { name: "Temas populares" });
    await expect(seccion).toBeVisible();

    const enPortada = await destinos(page, 'section[aria-labelledby="temas-populares"]');
    expect(enPortada.length).toBeGreaterThan(0);

    // Los que anuncia el sitemap son los que superan el umbral (HU-058); los de
    // la portada son una muestra de esos, nunca uno que no lo supere.
    const anunciados = await temasDelSitemap(page);
    for (const href of enPortada) expect(anunciados, href).toContain(href);

    await seccion.getByRole("link", { name: "Ver todos los temas →" }).click();
    await expect(page).toHaveURL(/\/cursos$/);
    // Y en el índice están todos, sin faltar ninguno.
    expect((await destinos(page, "main")).sort()).toEqual(anunciados);

    await page.getByRole("link", { name: "Python", exact: true }).click();
    await expect(page).toHaveURL(/\/cursos\/python$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos de Python en español");
  });

  test("una categoría enlaza a los temas de los que tiene la mayoría de cursos en español", async ({ page }) => {
    await page.goto("/categoria/desarrollo");
    const deDesarrollo = await destinos(page, 'nav[aria-label="Temas de esta categoría"]');
    // Python (31 de 54 en desarrollo), SQL (27 de 36), desarrollo web (24 de 43).
    expect(deDesarrollo).toEqual(expect.arrayContaining(["/cursos/python", "/cursos/sql", "/cursos/desarrollo-web"]));
    // Marketing digital es de negocios (95 de 104), no de desarrollo.
    expect(deDesarrollo).not.toContain("/cursos/marketing-digital");

    await page.goto("/categoria/negocios");
    expect(await destinos(page, 'nav[aria-label="Temas de esta categoría"]')).toContain("/cursos/marketing-digital");

    // Un empate enlaza desde las dos: meditación tiene 14 y 14.
    for (const categoria of ["desarrollo-personal", "salud-y-bienestar"]) {
      await page.goto(`/categoria/${categoria}`);
      expect(await destinos(page, 'nav[aria-label="Temas de esta categoría"]'), categoria).toContain(
        "/cursos/meditacion-y-mindfulness"
      );
    }
  });

  test("la ficha de un curso de un tema enlaza a la página de ese tema", async ({ page }) => {
    await page.goto("/cursos/python");
    const ficha = (await page.locator("main ul li h2 a").first().getAttribute("href"))!;

    await page.goto(ficha);
    const nav = page.getByRole("navigation", { name: "Más cursos de este tema" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Python", exact: true }).click();
    await expect(page).toHaveURL(/\/cursos\/python$/);
  });
});
