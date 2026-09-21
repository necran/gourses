import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-071 que solo se ve en producción.
//
// Cuenta lo que llega **al servidor**, que en Netlify es lo que cuesta créditos:
// el HTML de la página y cualquier petición a otra ruta del sitio. Se descartan
// los ficheros estáticos de `/_next/static` y las imágenes optimizadas, que salen
// del CDN sin ejecutar ninguna función.
//
// Antes de HU-071, una visita con scroll generaba 13-65 peticiones, casi todas
// `?_rsc=`: el prefetch de cada enlace que entraba en pantalla.

const ORIGEN = "http://localhost:3300";
const MAXIMO_POR_VISITA = 3;

async function visitar(page: Page, ruta: string): Promise<string[]> {
  const alServidor: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(ORIGEN)) return;
    const { pathname, search } = new URL(r.url());
    if (pathname.startsWith("/_next/static") || pathname.startsWith("/_next/image")) return;
    alServidor.push(pathname + search);
  });

  await page.goto(ruta, { waitUntil: "load" });
  // Scroll hasta abajo en pasos: es lo que hace entrar los enlaces en pantalla, que
  // es cuando Next los prefetcha.
  for (let y = 0; y < 8000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2000);
  return alServidor;
}

test.describe("HU-071 — el coste de una visita", () => {
  test("una visita a cualquier página pública llega al servidor como mucho 3 veces, sin `_rsc`", async ({
    page,
    request,
  }) => {
    // Son 12 visitas con scroll y espera, unos 4 s cada una: más de los 30 s por
    // defecto, que es para tests de una sola acción.
    test.setTimeout(180_000);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    const ficha = sitemap.match(/<loc>[^<]*(\/curso\/[0-9a-f-]{36})<\/loc>/)?.[1];
    expect(ficha, "el sitemap debería tener al menos una ficha").toBeTruthy();

    const paginas = [
      "/",
      "/buscar",
      "/buscar?keyword=python",
      "/categoria",
      "/categoria/negocios",
      "/cursos",
      "/cursos/python",
      "/novedades",
      "/guias",
      "/guias/udemy-o-coursera",
      ficha!,
      "/privacidad",
    ];

    const excedidas: string[] = [];
    for (const ruta of paginas) {
      // Una pestaña nueva por página, para que las peticiones de una no se
      // cuenten en la siguiente, y cerrada al acabar.
      const pestana = await page.context().newPage();
      const peticiones = await visitar(pestana, ruta).finally(() => pestana.close());
      const conRsc = peticiones.filter((p) => p.includes("_rsc="));
      if (peticiones.length > MAXIMO_POR_VISITA || conRsc.length > 0) {
        excedidas.push(`${ruta}: ${peticiones.length} peticiones, ${conRsc.length} con _rsc`);
      }
    }

    expect(excedidas).toEqual([]);
  });

  test("sin prefetch, los enlaces siguen llevando a su página", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Buscar cursos" }).click();
    await expect(page).toHaveURL(/\/buscar$/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    // Del listado a una ficha, y de la ficha atrás: la navegación entre páginas con
    // datos también funciona sin haber prefetchado nada.
    await page.locator("main li h2 a").first().click();
    await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/categoria");
    await page.getByRole("link", { name: "Negocios", exact: true }).click();
    await expect(page).toHaveURL(/\/categoria\/negocios$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos de Negocios");
  });
});
