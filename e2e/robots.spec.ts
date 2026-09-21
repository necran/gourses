import { expect, test } from "@playwright/test";

// Criterios de HU-071 sobre robots.txt, tal y como lo sirve el sitio. La lógica de
// qué se bloquea y qué no la prueban los unitarios de `robots.ts`; aquí se
// comprueba lo que de verdad llega a un rastreador.

async function robots(page: import("@playwright/test").Page): Promise<string> {
  const res = await page.request.get("/robots.txt");
  expect(res.status()).toBe(200);
  return res.text();
}

test.describe("HU-071 — robots.txt", () => {
  test("pide no rastrear las búsquedas con filtros, los datos internos de Next y las páginas de cuenta", async ({
    page,
  }) => {
    const texto = await robots(page);

    for (const ruta of ["/buscar?", "/*_rsc=", "/comparar", "/favoritos", "/mi-cuenta", "/acceder"]) {
      expect(texto, ruta).toMatch(new RegExp(`^Disallow: ${ruta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "mi"));
    }
  });

  test("bloquea por completo a los rastreadores de IA y SEO sin valor", async ({ page }) => {
    const texto = await robots(page);

    for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Bytespider", "AhrefsBot", "SemrushBot"]) {
      expect(texto, bot).toMatch(new RegExp(`^User-Agent: ${bot}$`, "mi"));
    }
    // Su grupo se cierra con «Disallow: /» a secas.
    expect(texto).toMatch(/^Disallow: \/$/m);
  });

  test("sigue permitiendo el resto, no bloquea a los buscadores y apunta al sitemap", async ({ page }) => {
    const texto = await robots(page);

    expect(texto).toMatch(/^Allow: \/$/m);
    expect(texto).toMatch(/^Sitemap: .*\/sitemap\.xml$/m);
    for (const bot of ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"]) {
      expect(texto, bot).not.toMatch(new RegExp(`User-Agent: ${bot}`, "i"));
    }
    // Ninguna ruta de contenido aparece bloqueada.
    for (const ruta of ["/curso", "/categoria", "/cursos", "/novedades", "/guias"]) {
      expect(texto, ruta).not.toMatch(new RegExp(`^Disallow: ${ruta}`, "m"));
    }
  });
});
