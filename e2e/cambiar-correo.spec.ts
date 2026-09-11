import { expect, test } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-037, salvo los que dependen de
// confirmar de verdad los dos enlaces del correo (canjearlos, comprobar que el
// correo cambia, que el límite de envío responde igual que en el acceso): esos
// se prueban contra el Supabase real en
// tests/integration/cambiar-correo.test.ts, con Mailpit — no hay browser de
// por medio en ese canje, así que no aporta hacerlo también aquí. Lo que sí es
// de interfaz —el formulario, sus validaciones, los tres avisos al volver del
// enlace, el aviso de cambio pendiente— se cubre abajo.

function correoUnico(que: string): string {
  return `zzz-hu037-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("HU-037 — cambiar el correo de la cuenta", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("en mi cuenta hay una sección para cambiar el correo", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("seccion"));
    try {
      await page.goto("/mi-cuenta");

      const seccion = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Cambiar tu correo" }) });
      await expect(seccion).toBeVisible();
      await expect(seccion.getByLabel(/correo nuevo/i)).toBeVisible();
      await expect(seccion.getByRole("button", { name: /cambiar correo/i })).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("un correo con formato inválido no envía nada y avisa", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("invalido"));
    try {
      await page.goto("/mi-cuenta");
      const seccion = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Cambiar tu correo" }) });

      await seccion.locator("form").evaluate((f: HTMLFormElement) => {
        f.noValidate = true;
      });
      await seccion.getByLabel(/correo nuevo/i).fill("esto-no-es-un-correo");
      await seccion.getByRole("button", { name: /cambiar correo/i }).click();

      await expect(seccion).toContainText(/dirección de correo válida/i);
      // No debe pasar al estado de "revisa tu correo".
      await expect(seccion).not.toContainText(/revisa tu correo/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("pedir el cambio a la misma dirección que ya tienes lo dice sin llamar a Supabase", async ({
    page,
    context,
  }) => {
    const correo = correoUnico("mismo");
    const { userId } = await abrirSesion(context, correo);
    try {
      await page.goto("/mi-cuenta");
      const seccion = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Cambiar tu correo" }) });

      await seccion.getByLabel(/correo nuevo/i).fill(correo);
      await seccion.getByRole("button", { name: /cambiar correo/i }).click();

      await expect(seccion).toContainText(/ya es la dirección de tu cuenta/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("pedir un cambio válido dice que hay que revisar el correo y dispara un cambio pendiente de verdad", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("pendiente"));
    const correoNuevo = correoUnico("pendiente-destino");
    try {
      await page.goto("/mi-cuenta");
      const seccion = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Cambiar tu correo" }) });

      await seccion.getByLabel(/correo nuevo/i).fill(correoNuevo);
      await seccion.getByRole("button", { name: /cambiar correo/i }).click();

      await expect(seccion).toContainText(/revisa tu correo/i);

      // No es solo un mensaje: recargar debe enseñar el aviso de cambio
      // pendiente, que sale de mirar la cuenta de verdad (`new_email`).
      await page.goto("/mi-cuenta");
      await expect(page.locator("main")).toContainText(correoNuevo);
      await expect(page.locator("main")).toContainText(/cambio pendiente/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("los tres avisos al volver del enlace se traducen y se distinguen por tono", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("avisos"));
    try {
      await page.goto("/mi-cuenta?correo=confirmado");
      await expect(page.getByRole("status")).toContainText(/ya es el nuevo/i);

      await page.goto("/mi-cuenta?correo=confirmado-parcial");
      await expect(page.getByRole("status").filter({ hasText: /abre también/i })).toBeVisible();

      await page.goto("/mi-cuenta?correo=enlace");
      // Este sí es un fallo: se anuncia como alert, no como status.
      await expect(page.getByRole("alert").filter({ hasText: /ya no vale/i })).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("un valor inventado en el aviso no se muestra", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("inventado"));
    try {
      await page.goto("/mi-cuenta?correo=" + encodeURIComponent("Tu cuenta está bloqueada"));
      await expect(page.locator("main")).not.toContainText("Tu cuenta está bloqueada");
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin sesión, no hay sección de cambiar correo y se lleva a acceder", async ({ page }) => {
    await page.goto("/mi-cuenta");
    await expect(page).toHaveURL(/\/acceder$/);
    await expect(page.getByRole("heading", { name: "Cambiar tu correo" })).toHaveCount(0);
  });

  test("la política de privacidad dice que la rectificación se ejerce desde la cuenta", async ({
    page,
  }) => {
    await page.goto("/privacidad");
    const derechos = page.locator("main");

    await expect(derechos).toContainText(/corregir tu correo/i);
    // Ya no queda agrupada con las que solo se piden por correo.
    await expect(derechos).not.toContainText(/rectificación, oposición y limitación/i);
  });
});
