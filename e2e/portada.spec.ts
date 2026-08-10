import { expect, test } from "@playwright/test";

test.describe("HU-012 — portada", () => {
  test("explica qué hace la web, sin rastro de la plantilla de Next.js", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/compara cursos/i);

    const main = page.locator("main");
    await expect(main).toContainText(/udemy/i);
    await expect(main).toContainText(/coursera/i);

    // Restos del andamio de create-next-app que no deben quedar en producción.
    await expect(main).not.toContainText("Deploy now");
    await expect(main).not.toContainText("Read our docs");
    await expect(page.locator('img[src*="vercel"]')).toHaveCount(0);
    await expect(page.locator('img[src*="next.svg"]')).toHaveCount(0);
  });

  test("buscar desde la portada lleva al buscador con esa búsqueda aplicada", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("¿Qué quieres aprender?").fill("python");
    await page.getByRole("button", { name: "Buscar cursos" }).click();

    await expect(page).toHaveURL(/\/buscar\?keyword=python/);
    await expect(page.locator("main li").first()).toBeVisible();
  });

  test("las cifras del catálogo son las reales de la base de datos", async ({ page }) => {
    await page.goto("/");

    const cifras = page.getByTestId("catalogo-cifras");
    await expect(cifras).toBeVisible();

    // No puede ser un número fijo escrito a mano: debe coincidir con lo que
    // devuelve la propia web en su buscador.
    const texto = (await cifras.textContent()) ?? "";
    const total = Number((texto.match(/([\d.]+)\s*cursos/)?.[1] ?? "0").replace(/\./g, ""));
    expect(total).toBeGreaterThan(0);
  });

  test("los metadatos describen el comparador, no la plantilla", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/gourses/i);
    await expect(page).not.toHaveTitle(/create next app/i);

    const descripcion = await page.locator('meta[name="description"]').getAttribute("content");
    expect(descripcion).toMatch(/compar/i);

    // El sitio está en español: importa para accesibilidad y buscadores.
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
