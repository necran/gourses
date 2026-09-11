import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-042. Cada test arranca con un
// contexto de navegador nuevo: cesta y última búsqueda empiezan vacías.

const barra = (page: Page) =>
  page.getByRole("complementary", { name: "Cursos marcados para comparar" });
const quitarDe = (page: Page, titulo: string) =>
  page.getByRole("table").getByRole("link", { name: `Quitar ${titulo} de la comparación` });
const volver = (page: Page) => page.getByRole("link", { name: /Volver a la búsqueda/ });

const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

interface Curso {
  id: string;
  titulo: string;
}

async function cursosDelBuscador(page: Page, cuantos: number): Promise<Curso[]> {
  await page.goto("/buscar");
  const enlaces = page.locator("main li h2 a");
  const cursos: Curso[] = [];
  for (let i = 0; i < cuantos; i++) {
    const href = (await enlaces.nth(i).getAttribute("href"))!;
    cursos.push({
      id: href.split("/").pop()!,
      titulo: ((await enlaces.nth(i).textContent()) ?? "").trim(),
    });
  }
  return cursos;
}

const idsEnLaUrl = (page: Page) =>
  (new URL(page.url()).searchParams.get("ids") ?? "").split(",").filter(Boolean);

test.describe("HU-042 — gestionar la comparación", () => {
  test("«Quitar» en una columna deja los otros, en la URL y en la cesta", async ({ page }) => {
    const cursos = await cursosDelBuscador(page, 3);
    await page.goto(`/comparar?ids=${cursos.map((c) => c.id).join(",")}`);
    await expect(barra(page)).toContainText("3 de 4");

    await quitarDe(page, cursos[2].titulo).click();

    await expect(page.locator("thead th")).toHaveCount(3);
    await expect.poll(() => idsEnLaUrl(page)).toEqual([cursos[0].id, cursos[1].id]);
    await expect(barra(page)).toContainText("2 de 4");
    await expect(barra(page)).not.toContainText(cursos[2].titulo);
  });

  test("quitar uno de dos explica que falta otro, y el que queda sigue en la cesta", async ({
    page,
  }) => {
    const cursos = await cursosDelBuscador(page, 2);
    await page.goto(`/comparar?ids=${cursos.map((c) => c.id).join(",")}`);
    await expect(barra(page)).toContainText("2 de 4");

    await quitarDe(page, cursos[1].titulo).click();

    await expect(page.getByRole("status")).toContainText(/al menos un curso más/i);
    await expect(barra(page)).toContainText("1 de 4");
    await expect(barra(page)).toContainText(cursos[0].titulo);
  });

  test("«Añadir otro curso» vuelve a la búsqueda con esos cursos marcados", async ({ page }) => {
    await page.goto("/buscar?keyword=python");
    const casillas = page.locator('input[type="checkbox"][name="ids"]');
    const ids = [
      (await casillas.nth(0).getAttribute("value"))!,
      (await casillas.nth(1).getAttribute("value"))!,
    ];
    await casillas.nth(0).check();
    await casillas.nth(1).check();
    await page.getByRole("button", { name: "Comparar seleccionados" }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);

    await page.getByRole("link", { name: "Añadir otro curso" }).click();

    await expect(page).toHaveURL(/\/buscar\?keyword=python$/);
    for (const id of ids) {
      await expect(page.locator(`input[type="checkbox"][value="${id}"]`)).toBeChecked();
    }
  });

  test("abrir un enlace de comparación compartido la convierte en la cesta", async ({ page }) => {
    const [propio, a, b] = await cursosDelBuscador(page, 3);
    await page.locator(`input[type="checkbox"][value="${propio.id}"]`).check();
    await expect(barra(page)).toContainText("1 de 4");

    await page.goto(`/comparar?ids=${a.id},${b.id}`);

    await expect(barra(page)).toContainText("2 de 4");
    await expect(barra(page)).toContainText(a.titulo);
    await expect(barra(page)).toContainText(b.titulo);
    await expect(barra(page)).not.toContainText(propio.titulo);
  });

  test("un curso retirado del catálogo desaparece también de la cesta", async ({ page }) => {
    const [a, b] = await cursosDelBuscador(page, 2);
    // Una cesta con un título guardado de un curso que ya no existe.
    await page.evaluate(
      ([aId, aTitulo, inexistente]) =>
        localStorage.setItem(
          "gourses:cesta-comparar",
          JSON.stringify([
            { id: aId, titulo: aTitulo },
            { id: inexistente, titulo: "Curso ya retirado" },
          ])
        ),
      [a.id, a.titulo, ID_INEXISTENTE]
    );

    await page.goto(`/comparar?ids=${a.id},${b.id},${ID_INEXISTENTE}`);

    await expect(page.locator("thead th")).toHaveCount(3);
    await expect(barra(page)).toContainText("2 de 4");
    await expect(barra(page)).not.toContainText("Curso ya retirado");
  });

  test("«Volver a la búsqueda» en /comparar y en la ficha vuelve a esa misma búsqueda", async ({
    page,
  }) => {
    const busqueda = "/buscar?keyword=a&orden=precio-asc&pagina=2";
    await page.goto(busqueda);
    await expect(page.getByText("Página 2")).toBeVisible();
    const casillas = page.locator('input[type="checkbox"][name="ids"]');
    await casillas.nth(0).check();
    await casillas.nth(1).check();

    const esaBusqueda = () => {
      const url = new URL(page.url());
      return [url.pathname, url.searchParams.get("keyword"), url.searchParams.get("orden"), url.searchParams.get("pagina")];
    };
    const esperado = ["/buscar", "a", "precio-asc", "2"];

    await page.getByRole("button", { name: "Comparar seleccionados" }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);
    await volver(page).click();
    await expect.poll(esaBusqueda).toEqual(esperado);

    await page.locator("main li h2 a").first().click();
    await expect(page).toHaveURL(/\/curso\//);
    await volver(page).click();
    await expect.poll(esaBusqueda).toEqual(esperado);
  });

  test("sin haber buscado en esta pestaña, «Volver a la búsqueda» lleva a /buscar", async ({
    page,
    context,
  }) => {
    const [a, b] = await cursosDelBuscador(page, 2);

    // Otra pestaña, abierta directamente en la comparación y en la ficha.
    const directa = await context.newPage();
    await directa.goto(`/comparar?ids=${a.id},${b.id}`);
    await expect(barra(directa)).toContainText("2 de 4");
    await expect(volver(directa)).toHaveAttribute("href", "/buscar");

    await directa.goto(`/curso/${a.id}`);
    // El botón de la ficha (no los de la barra): ya hidratada, el enlace
    // también lo está.
    await expect(
      directa.getByRole("button", { name: "Quitar de la comparación", exact: true })
    ).toBeVisible();
    await volver(directa).click();
    await expect(directa).toHaveURL(/\/buscar$/);
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("«Quitar» sigue funcionando y «Volver a la búsqueda» lleva a /buscar", async ({
      page,
    }) => {
      const cursos = await cursosDelBuscador(page, 3);
      await page.goto(`/comparar?ids=${cursos.map((c) => c.id).join(",")}`);

      await quitarDe(page, cursos[0].titulo).click();

      await expect(page.locator("thead th")).toHaveCount(3);
      expect(idsEnLaUrl(page)).toEqual([cursos[1].id, cursos[2].id]);
      await expect(volver(page)).toHaveAttribute("href", "/buscar");
    });
  });
});
