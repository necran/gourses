import { expect, test } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Criterio de aceptación de HU-021 que se ve en la web: poder dejar de recibir
// los avisos. Los demás criterios viven en el job y se prueban contra la base de
// datos en tests/integration/alertas-precio.test.ts, porque implican esperar a
// una bajada de precio y a un envío de correo.

function correoUnico(que: string): string {
  return `zzz-hu021-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("HU-021 — avisos de bajada de precio", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("los avisos vienen activados de fábrica", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("defecto"));
    try {
      await page.goto("/mi-cuenta");

      await expect(page.getByRole("checkbox", { name: /quiero recibir estos avisos/i })).toBeChecked();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("se pueden desactivar, y sigue desactivado al volver", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("desactivar"));
    try {
      await page.goto("/mi-cuenta");

      const casilla = page.getByRole("checkbox", { name: /quiero recibir estos avisos/i });
      await casilla.uncheck();
      await page.getByRole("button", { name: "Guardar" }).click();

      // Hay que esperar a que el servidor confirme antes de navegar: si no, la
      // navegación cancela el envío a media escritura y el test culpa al código
      // de algo que no ha hecho.
      await expect(page.getByRole("status")).toContainText(/no te enviaremos más avisos/i);

      // Recargar es lo que de verdad demuestra que se guardó, y no solo que la
      // casilla cambió en pantalla.
      await page.goto("/mi-cuenta");
      await expect(casilla).not.toBeChecked();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("se pueden volver a activar", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("reactivar"));
    try {
      await page.goto("/mi-cuenta");
      const casilla = page.getByRole("checkbox", { name: /quiero recibir estos avisos/i });

      await casilla.uncheck();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("status")).toContainText(/no te enviaremos más avisos/i);
      await page.goto("/mi-cuenta");
      await expect(casilla).not.toBeChecked();

      await casilla.check();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("status")).toContainText(/te avisaremos/i);
      await page.goto("/mi-cuenta");
      await expect(casilla).toBeChecked();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("la política de privacidad declara que enviamos estos correos", async ({ page }) => {
    await page.goto("/privacidad");

    const main = page.locator("main");
    await expect(main).toContainText(/avisos de bajada de precio/i);
    await expect(main).toContainText(/nunca publicidad/i);
    // Y dice cómo salirse.
    await expect(main).toContainText(/puedes desactivarlos/i);
  });
});
