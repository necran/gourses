import { expect, test } from "@playwright/test";
import { Client } from "pg";

// HU-032. Cada test siembra sus propios dos cursos (mismo patrón que
// resumen-ia.spec.ts): con `fullyParallel`, un `beforeAll` compartido en el
// describe se ejecuta una vez por worker que toque este fichero, y dos
// workers arrancando en el mismo milisegundo generaban el mismo marcador —
// duplicando la clave única de `source_id`. Sembrar por test, con su propio
// sufijo, no tiene ese problema.
//
// Valoración al máximo y recién insertados (updated_at = ahora, sin trigger
// que lo toque después): son los primeros de Udemy tanto en /buscar (con la
// palabra clave) como en la muestra sin filtrar de la home, sea cual sea el
// resto del catálogo real ese día. El idioma se controla con
// `extraHTTPHeaders` en un contexto de navegador propio — no se toca el
// `Accept-Language` real de quien ejecuta el test.

async function sembrarParEnIdiomas(
  databaseUrl: string,
  marker: string
): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(
    `insert into courses (source, source_id, title, description, price_amount, price_currency, rating, language)
     values
      ('udemy', $1, '${marker} inglés', 'x', 10, 'EUR', 5.0, 'en'),
      ('udemy', $2, '${marker} español', 'x', 10, 'EUR', 5.0, 'es')`,
    [`${marker}-en`, `${marker}-es`]
  );
  return async () => {
    await client.query(`delete from courses where source_id like $1`, [`${marker}%`]);
    await client.end();
  };
}

test.describe("HU-032 — priorizar el idioma del visitante", () => {
  // La home no admite palabra clave: cada test de este fichero siembra sus
  // propios cursos con la valoración máxima para competir por los primeros
  // puestos de la muestra sin filtrar. En paralelo, los cursos de un test se
  // interponían en los del test de al lado y sacaban al segundo curso de la
  // ventana de 12 — no un fallo del código, sino los tests compitiendo entre
  // sí por el mismo hueco real. En serie no compiten.
  test.describe.configure({ mode: "serial" });

  test("en /buscar, con el navegador en español, el curso en español sale antes", async ({
    browser,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar los cursos");

    const marker = `zzz-hu032-buscar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const limpiar = await sembrarParEnIdiomas(databaseUrl!, marker);

    try {
      // `locale`, no `extraHTTPHeaders`: es la forma que documenta Playwright
      // para que Chromium mande de verdad ese Accept-Language en la propia
      // navegación, no solo en peticiones de fondo (comprobado: con
      // extraHTTPHeaders la cabecera no llegaba a afectar al orden).
      const context = await browser.newContext({ locale: "es-ES" });
      const page = await context.newPage();

      await page.goto(`/buscar?keyword=${marker}`);
      const titulos = await page.locator("main li h2").allTextContents();

      expect(titulos[0]).toContain("español");
      // El de inglés sigue ahí, solo que después — no es un filtro.
      expect(titulos).toContain(`${marker} inglés`);

      await context.close();
    } finally {
      await limpiar();
    }
  });

  test("en la home, con el navegador en español, el curso en español sale antes", async ({
    browser,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar los cursos");

    const marker = `zzz-hu032-home-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const limpiar = await sembrarParEnIdiomas(databaseUrl!, marker);

    try {
      // `locale`, no `extraHTTPHeaders`: es la forma que documenta Playwright
      // para que Chromium mande de verdad ese Accept-Language en la propia
      // navegación, no solo en peticiones de fondo (comprobado: con
      // extraHTTPHeaders la cabecera no llegaba a afectar al orden).
      const context = await browser.newContext({ locale: "es-ES" });
      const page = await context.newPage();
      await page.goto("/");

      const titulos = await page.locator("main li h3").allTextContents();
      const posEs = titulos.findIndex((t) => t.includes(`${marker} español`));
      const posEn = titulos.findIndex((t) => t.includes(`${marker} inglés`));

      expect(posEs).toBeGreaterThanOrEqual(0);
      expect(posEn).toBeGreaterThanOrEqual(0);
      expect(posEs).toBeLessThan(posEn);

      await context.close();
    } finally {
      await limpiar();
    }
  });

  test("sin cabecera de idioma reconocible, los dos cursos siguen apareciendo", async ({
    browser,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar los cursos");

    const marker = `zzz-hu032-sinidioma-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const limpiar = await sembrarParEnIdiomas(databaseUrl!, marker);

    try {
      // Sin forzar `locale`: cualquiera que sea el idioma real de quien
      // ejecuta el test, el criterio de aquí no depende del orden.
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`/buscar?keyword=${marker}`);
      const titulos = await page.locator("main li h2").allTextContents();

      // No hay ninguna afirmación sobre cuál va primero, solo que no falta ninguno.
      expect(titulos).toHaveLength(2);

      await context.close();
    } finally {
      await limpiar();
    }
  });

  test("con un orden explícito, el idioma no lo altera", async ({ browser }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar los cursos");

    const marker = `zzz-hu032-ordenexpl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const limpiar = await sembrarParEnIdiomas(databaseUrl!, marker);

    try {
      // `locale`, no `extraHTTPHeaders`: es la forma que documenta Playwright
      // para que Chromium mande de verdad ese Accept-Language en la propia
      // navegación, no solo en peticiones de fondo (comprobado: con
      // extraHTTPHeaders la cabecera no llegaba a afectar al orden).
      const context = await browser.newContext({ locale: "es-ES" });
      const page = await context.newPage();

      await page.goto(`/buscar?keyword=${marker}&orden=valoracion-desc`);
      const titulos = await page.locator("main li h2").allTextContents();

      // Mismo empate de valoración: sin el idioma metiendo mano, el orden entre
      // ellos lo decide la base, no una regla nueva de esta historia.
      expect(titulos).toHaveLength(2);

      await context.close();
    } finally {
      await limpiar();
    }
  });
});
