import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-062. Con la pantalla a 400 × 800, la
// referencia de móvil estrecho del proyecto (HU-043), salvo el de escritorio.

test.use({ viewport: { width: 400, height: 800 } });

// La guía de HU-063 se añade aquí: su tabla tiene que desplazarse sola, sin que
// la página se salga de la pantalla.
// Los índices de HU-070 entran aquí: son listas de pastillas que se pulsan con
// el dedo, igual que las de la portada.
const PAGINAS = [
  "/",
  "/categoria",
  "/categoria/desarrollo",
  "/cursos",
  "/cursos/python",
  "/novedades",
  "/privacidad",
  "/guias/udemy-o-coursera",
];

async function medir(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.opacity !== "0";
    };
    const pequenos = [...document.querySelectorAll("main a, main button, main input, main select")]
      .filter(visible)
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      })
      .map((e) => `${e.tagName.toLowerCase()} «${(e.textContent ?? "").trim().slice(0, 30)}» ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);

    const letra = [...document.querySelectorAll("main *")]
      .filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
      .map((e) => `${e.tagName.toLowerCase()}.${e.className.toString().split(" ")[0]} ${getComputedStyle(e).fontSize}`);

    const ancho = innerWidth;
    const seSale = [...document.querySelectorAll("body *")]
      .filter((e) => {
        if (e.getBoundingClientRect().right <= ancho + 1) return false;
        for (let p = e.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll") return false;
        }
        return true;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${e.className.toString().split(" ")[0]}`);

    return { pequenos, letra, seSale, scroll: document.documentElement.scrollWidth - innerWidth };
  });
}

test.describe("HU-062 — el móvil de las páginas nuevas", () => {
  for (const ruta of PAGINAS) {
    test(`${ruta}: los enlaces y botones miden al menos 24 × 24 px`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect((await medir(page)).pequenos).toEqual([]);
    });
  }

  test("ningún texto baja de 12 px en esas páginas", async ({ page }) => {
    for (const ruta of PAGINAS) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect((await medir(page)).letra, ruta).toEqual([]);
    }
  });

  test("nada se sale de la pantalla en esas páginas", async ({ page }) => {
    for (const ruta of PAGINAS) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { seSale, scroll } = await medir(page);
      expect(seSale, ruta).toEqual([]);
      expect(scroll, ruta).toBeLessThanOrEqual(0);
    }
  });

  test("en escritorio la disposición no cambia: las tarjetas siguen con la imagen al lado del título", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const ruta of ["/categoria/desarrollo", "/cursos/python", "/novedades"]) {
      await page.goto(ruta);
      const tarjeta = page.locator("main ul li:has(img)").first();
      const imagen = (await tarjeta.locator("img").boundingBox())!;
      const titulo = (await tarjeta.locator("h2").boundingBox())!;
      expect(titulo.x, ruta).toBeGreaterThan(imagen.x + imagen.width - 1);
      expect(titulo.y, ruta).toBeLessThan(imagen.y + imagen.height);
    }
  });
});
