import { expect, test } from "@playwright/test";
import { abrirSesion, clienteAdmin, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-020.

function correoUnico(que: string): string {
  return `zzz-hu020-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function cuentaSigueExistiendo(userId: string): Promise<boolean> {
  const { data } = await clienteAdmin().auth.admin.getUserById(userId);
  return Boolean(data?.user);
}

test.describe("HU-020 — borrar la cuenta", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("mi cuenta ofrece borrarla, avisando de que no tiene vuelta atrás", async ({
    page,
    context,
  }) => {
    const { userId, correo } = await abrirSesion(context, correoUnico("aviso"));
    try {
      await page.goto("/mi-cuenta");

      const zona = page.getByRole("heading", { name: /borrar mi cuenta/i });
      await expect(zona).toBeVisible();
      await expect(page.locator("main")).toContainText(/no tiene vuelta atrás/i);
      // Dice exactamente qué hay que escribir.
      await expect(page.locator("main")).toContainText(correo);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin escribir el correo exacto no se borra nada", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("sinconfirmar"));
    try {
      await page.goto("/mi-cuenta");

      await page.locator("#confirmacion").fill("otra-cosa@example.com");
      await page.getByRole("button", { name: /borrar mi cuenta para siempre/i }).click();

      const error = page.locator("#error-borrado");
      await expect(error).toContainText(/exactamente/i);
      await expect(error).toHaveAttribute("role", "alert");

      // Y, sobre todo: la cuenta sigue ahí.
      expect(await cuentaSigueExistiendo(userId)).toBe(true);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("escribiendo el correo se borra la cuenta y se confirma", async ({ page, context }) => {
    const { userId, correo } = await abrirSesion(context, correoUnico("borrado"));

    await page.goto("/mi-cuenta");
    await page.locator("#confirmacion").fill(correo);
    await page.getByRole("button", { name: /borrar mi cuenta para siempre/i }).click();

    await expect(page).toHaveURL(/\/cuenta-borrada$/);
    await expect(page.getByRole("status")).toContainText(/no queda nada tuyo/i);

    expect(await cuentaSigueExistiendo(userId)).toBe(false);
  });

  test("tras borrarla, las páginas privadas llevan a acceder", async ({ page, context }) => {
    const { correo } = await abrirSesion(context, correoUnico("sinsesion"));

    await page.goto("/mi-cuenta");
    await page.locator("#confirmacion").fill(correo);
    await page.getByRole("button", { name: /borrar mi cuenta para siempre/i }).click();
    await expect(page).toHaveURL(/\/cuenta-borrada$/);

    for (const ruta of ["/mi-cuenta", "/favoritos"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/acceder$/);
    }
  });

  test("los favoritos desaparecen con la cuenta", async ({ page, context }) => {
    const { userId, correo } = await abrirSesion(context, correoUnico("confavoritos"));

    // Guardar un curso por el camino normal.
    await page.goto("/buscar");
    await page.locator("main li h2 a").first().click();
    await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: /guardar en favoritos/i }).click();
    await expect(page.getByRole("button", { name: /quitar de favoritos/i })).toBeVisible();

    const admin = clienteAdmin();
    const { count: antes } = await admin
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(antes).toBe(1);

    await page.goto("/mi-cuenta");
    await page.locator("#confirmacion").fill(correo);
    await page.getByRole("button", { name: /borrar mi cuenta para siempre/i }).click();
    await expect(page).toHaveURL(/\/cuenta-borrada$/);

    const { count: despues } = await admin
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(despues).toBe(0);
  });
});
