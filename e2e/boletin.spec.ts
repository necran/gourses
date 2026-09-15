import { expect, test } from "@playwright/test";
import { abrirSesion, borrarUsuario, clienteAdmin, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-066 visible en la web. Lo que hace el
// job (a quién envía, sin repetir, sin contenido) se prueba en integración y
// unitarios, porque implica enviar correo.

function correoUnico(que: string): string {
  return `zzz-hu066-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

const casillaBoletin = (page: import("@playwright/test").Page) =>
  page.getByRole("checkbox", { name: /quiero recibir el boletín semanal/i });

async function apuntarse(page: import("@playwright/test").Page) {
  await page.goto("/mi-cuenta");
  await casillaBoletin(page).check();
  await page.getByRole("button", { name: "Guardar preferencia" }).click();
  await expect(page.getByRole("status")).toContainText(/te enviaremos el boletín cada semana/i);
}

async function suscripcion(userId: string) {
  const { data } = await clienteAdmin()
    .from("boletin_suscripciones")
    .select("activo, token_baja, consentido_en")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

test.describe("HU-066 — boletín semanal", () => {
  test("el boletín viene desmarcado y no se apunta a nadie por tener cuenta", async ({ page, context }) => {
    test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");
    const { userId } = await abrirSesion(context, correoUnico("defecto"));
    try {
      await page.goto("/mi-cuenta");
      await expect(casillaBoletin(page)).not.toBeChecked();
      expect(await suscripcion(userId)).toBeNull();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("apuntarse se guarda, y «Qué guardamos» y la descarga de datos lo reflejan", async ({ page, context }) => {
    test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");
    const { userId } = await abrirSesion(context, correoUnico("apuntarse"));
    try {
      await apuntarse(page);

      await page.goto("/mi-cuenta");
      await expect(casillaBoletin(page)).toBeChecked();
      const fila = page.locator("dl div").filter({ hasText: "Boletín semanal" });
      await expect(fila.locator("dd")).toHaveText("Apuntado");

      const datos = await (await page.request.get("/mi-cuenta/exportar")).json();
      expect(datos.preferencias.boletinSemanal).toBe(true);
      expect((await suscripcion(userId))?.consentido_en).toBeTruthy();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("el enlace de baja, sin sesión, da de baja al pulsar el botón y no antes", async ({
    page,
    context,
    browser,
  }) => {
    test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");
    const { userId } = await abrirSesion(context, correoUnico("baja"));
    try {
      await apuntarse(page);
      const { token_baja } = (await suscripcion(userId))!;

      // Otro navegador, sin sesión: como quien abre el enlace desde el correo.
      const sinSesion = await browser.newContext();
      try {
        const otra = await sinSesion.newPage();
        await otra.goto(`/boletin/baja?t=${token_baja}`);
        await expect(otra.getByRole("button", { name: "Darme de baja" })).toBeVisible();
        expect((await suscripcion(userId))?.activo).toBe(true);

        await otra.getByRole("button", { name: "Darme de baja" }).click();
        await expect(otra.getByRole("status")).toContainText(/no te enviaremos más boletines/i);
      } finally {
        await sinSesion.close();
      }

      expect((await suscripcion(userId))?.activo).toBe(false);
      await page.goto("/mi-cuenta");
      await expect(casillaBoletin(page)).not.toBeChecked();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("un enlace de baja no válido lo dice y ofrece «Mi cuenta»", async ({ page }) => {
    for (const ruta of ["/boletin/baja?t=no-es-un-token", "/boletin/baja?t=00000000-0000-4000-8000-000000000000&estado=invalido"]) {
      await page.goto(ruta);
      // Dentro de `main`: Next.js tiene su propio anunciador de rutas con rol «alert».
      const aviso = page.getByRole("main").getByRole("alert");
      await expect(aviso).toContainText(/no es válido/i);
      await expect(aviso.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/mi-cuenta");
      await expect(page.getByRole("button", { name: "Darme de baja" })).toHaveCount(0);
    }
  });

  test("la política de privacidad declara el boletín, su base y cómo darse de baja", async ({ page }) => {
    await page.goto("/privacidad");
    const seccion = page.locator("main");
    await expect(page.getByRole("heading", { name: "Boletín semanal, solo si te apuntas" })).toBeVisible();
    await expect(seccion).toContainText(/consentimiento[\s\S]*6\.1\.a[\s\S]*artículo 21 de la LSSI/);
    await expect(seccion).toContainText(/darte de baja cuando quieras con el enlace que lleva cada boletín/i);
    await expect(seccion).toContainText(/Viene desmarcado/);
  });
});
