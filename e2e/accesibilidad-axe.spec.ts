import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Client } from "pg";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-064. axe revisa la página ya
// renderizada contra WCAG 2.2 AA y sus buenas prácticas; cada infracción se
// informa con la regla y los elementos, para arreglarla sin volver a buscarla.

const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function infracciones(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  return violations.map(
    (v) => `${page.url()} ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(", ")}`
  );
}

async function revisar(page: Page, rutas: readonly string[]): Promise<string[]> {
  const todas: string[] = [];
  for (const ruta of rutas) {
    await page.goto(ruta);
    await expect(page.locator("main")).toBeVisible();
    todas.push(...(await infracciones(page)));
  }
  return todas;
}

// Un curso de cada plataforma: sus fichas no son iguales (Coursera no tiene
// precio ni valoración) y la comparación los junta.
async function unCursoDeCada(): Promise<[string, string]> {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const { rows } = await pg.query(
      `(select id from courses where source = 'udemy' and language = 'es' order by num_reviews desc nulls last, id limit 1)
       union all
       (select id from courses where source = 'coursera' order by id limit 1)`
    );
    return [rows[0].id, rows[1].id];
  } finally {
    await pg.end();
  }
}

async function paginasPublicas(): Promise<string[]> {
  const [udemy, coursera] = await unCursoDeCada();
  return [
    "/",
    "/buscar",
    "/buscar?keyword=python",
    `/curso/${udemy}`,
    `/curso/${coursera}`,
    `/comparar?ids=${udemy},${coursera}`,
    "/comparar",
    "/categoria/desarrollo",
    "/cursos/python",
    "/novedades",
    "/guias/udemy-o-coursera",
    "/privacidad",
    "/aviso-legal",
    "/afiliacion",
    "/acceder",
    "/favoritos",
    "/esta-direccion-no-existe",
  ];
}

test.describe("HU-064 — accesibilidad revisada con axe", () => {
  // En serie: cada revisión recorre muchas páginas, y lanzarlas en varios workers
  // a la vez cargaba el servidor de desarrollo hasta hacer fallar por tiempo
  // tests de otras historias.
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test("las páginas públicas no tienen infracciones en tema claro", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    expect(await revisar(page, await paginasPublicas())).toEqual([]);
  });

  test("las páginas públicas no tienen infracciones en tema oscuro", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await revisar(page, await paginasPublicas())).toEqual([]);
  });

  test("en el móvil, con los filtros del buscador desplegados, no hay infracciones", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    const [udemy, coursera] = await unCursoDeCada();
    const errores = await revisar(page, ["/", `/curso/${udemy}`, `/comparar?ids=${udemy},${coursera}`, "/guias/udemy-o-coursera"]);

    await page.goto("/buscar?keyword=python");
    await page.getByText("Filtros y orden").click();
    await expect(page.getByLabel("Precio máximo")).toBeVisible();
    errores.push(...(await infracciones(page)));

    expect(errores).toEqual([]);
  });

  test("con sesión abierta, «Mi cuenta» y «Favoritos» no tienen infracciones", async ({ page, context }) => {
    test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");
    const correo = `zzz-hu064-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { userId } = await abrirSesion(context, correo);
    try {
      // Con un favorito guardado, para revisar la lista con contenido y no solo vacía.
      const [udemy] = await unCursoDeCada();
      await page.goto(`/curso/${udemy}`);
      await page.getByRole("button", { name: /Guardar en favoritos/i }).click();
      await expect(page.getByRole("button", { name: /Quitar de favoritos/i })).toBeVisible();

      expect(await revisar(page, ["/mi-cuenta", "/favoritos"])).toEqual([]);
      await expect(page.locator("main li")).not.toHaveCount(0);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("en escritorio, el tabulador nunca se para en un control invisible del buscador", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/buscar");
    await page.locator("main").getByRole("textbox", { name: "Palabra clave" }).focus();

    // Recorre el formulario hasta salir de él y anota cada control enfocado sin tamaño o transparente.
    const invisibles: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const foco = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || !e.closest("form")) return null;
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return { id: e.id || e.tagName, invisible: r.width < 2 || r.height < 2 || s.opacity === "0" };
      });
      if (!foco) break;
      if (foco.invisible) invisibles.push(foco.id);
    }
    expect(invisibles).toEqual([]);
  });

  test("una dirección que no existe responde 404 con contenido principal y por dónde seguir", async ({ page }) => {
    const respuesta = await page.goto("/esta-direccion-no-existe");
    expect(respuesta?.status()).toBe(404);

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("Esta página no existe");
    await expect(main.getByRole("link", { name: "Buscar cursos" })).toHaveAttribute("href", "/buscar");
    await expect(main.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(await page.locator('meta[name="robots"]').first().getAttribute("content")).toMatch(/noindex/);
  });
});
