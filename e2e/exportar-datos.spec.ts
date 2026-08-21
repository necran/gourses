import { expect, test, type Page } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-024.
//
// La descarga no se prueba pinchando el enlace: lo que el navegador haga con un
// adjunto depende de su configuración, y aquí lo que importa es qué manda el
// servidor. Se pide la ruta con `request`, que devuelve la respuesta cruda —
// cabeceras incluidas, que es donde viven la mitad de los criterios.

function correoUnico(que: string): string {
  return `zzz-hu024-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Guarda el primer curso del catálogo y devuelve su título.
async function guardarPrimerCurso(page: Page): Promise<string> {
  await page.goto("/buscar");
  const primero = page.locator("main li h2 a").first();
  const titulo = ((await primero.textContent()) ?? "").trim();
  await primero.click();
  await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: /Guardar en favoritos/i }).click();
  await expect(page.getByRole("button", { name: /Quitar de favoritos/i })).toBeVisible();
  return titulo;
}

test.describe("HU-024 — exportar mis datos", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("en mi cuenta encuentro cómo descargar mis datos", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("enlace"));
    try {
      await page.goto("/mi-cuenta");

      const enlace = page.getByRole("link", { name: /Descargar mis datos/i });
      await expect(enlace).toBeVisible();
      await expect(enlace).toHaveAttribute("href", "/mi-cuenta/exportar");
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("el fichero trae mi correo, mis favoritos y mi preferencia de avisos", async ({
    page,
    context,
  }) => {
    const correo = correoUnico("contenido");
    const { userId } = await abrirSesion(context, correo);
    try {
      const titulo = await guardarPrimerCurso(page);

      const respuesta = await page.request.get("/mi-cuenta/exportar");
      expect(respuesta.status()).toBe(200);

      const datos = JSON.parse(await respuesta.text());

      expect(datos.cuenta.correo).toBe(correo);
      expect(datos.preferencias).toHaveProperty("avisosDeBajadaDePrecio");
      expect(datos.favoritos.map((f: { titulo: string }) => f.titulo)).toContain(titulo);
      // Legible por máquina de verdad: la versión del formato permite saber
      // contra qué forma se está leyendo.
      expect(datos.formato).toBe(1);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin sesión, pedir la ruta no devuelve datos y lleva a acceder", async ({ page }) => {
    // Sin `abrirSesion`: este contexto no tiene cookies.
    const respuesta = await page.request.get("/mi-cuenta/exportar");

    // `request` sigue la redirección, así que se comprueba dónde acabó y que lo
    // que llega es la página de acceso, no un JSON.
    expect(new URL(respuesta.url()).pathname).toBe("/acceder");
    expect(await respuesta.text()).not.toContain("avisosDeBajadaDePrecio");
  });

  test("en mi fichero no aparece nada de otra persona", async ({ page, context, browser }) => {
    const correoAjeno = correoUnico("ajeno");
    const otroContexto = await browser.newContext();
    const ajeno = await abrirSesion(otroContexto, correoAjeno);
    const otraPagina = await otroContexto.newPage();

    const mio = await abrirSesion(context, correoUnico("propio"));
    try {
      // La otra persona guarda un curso; yo no guardo nada.
      await guardarPrimerCurso(otraPagina);

      await page.goto("/mi-cuenta");
      const respuesta = await page.request.get("/mi-cuenta/exportar");
      const texto = await respuesta.text();

      expect(texto).not.toContain(correoAjeno);
      expect(JSON.parse(texto).favoritos).toEqual([]);
    } finally {
      await otroContexto.close();
      await borrarUsuario(ajeno.userId);
      await borrarUsuario(mio.userId);
    }
  });

  test("la descarga no se queda en caché de nadie", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("cache"));
    try {
      const respuesta = await page.request.get("/mi-cuenta/exportar");
      const cabeceras = respuesta.headers();

      // Datos personales servidos desde una CDN: una copia guardada podría
      // acabar servida a quien no debe.
      expect(cabeceras["cache-control"]).toContain("no-store");
      expect(cabeceras["vary"]).toContain("Cookie");

      // Y como adjunto, no como página que se renderice dentro del sitio.
      expect(cabeceras["content-disposition"]).toContain("attachment");
      // El nombre del fichero queda en la carpeta de descargas: sin correo.
      expect(cabeceras["content-disposition"]).toMatch(
        /filename="gourses-mis-datos-\d{4}-\d{2}-\d{2}\.json"/
      );
      expect(cabeceras["content-disposition"]).not.toContain("@");
    } finally {
      await borrarUsuario(userId);
    }
  });
});
