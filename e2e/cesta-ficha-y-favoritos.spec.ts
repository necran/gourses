import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { abrirSesion, borrarUsuario, clienteAdmin, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-041. Cada test arranca con un
// contexto de navegador nuevo, así que la cesta empieza vacía.

const barra = (page: Page) =>
  page.getByRole("complementary", { name: "Cursos marcados para comparar" });

// Con rol de botón solo existe tras hidratar (antes es un enlace a /buscar),
// así que esperar a él es esperar a que la cesta esté disponible.
const botonAnadir = (donde: Page | ReturnType<Page["locator"]>) =>
  donde.getByRole("button", { name: "Añadir a la comparación" });
const botonQuitar = (donde: Page | ReturnType<Page["locator"]>) =>
  donde.getByRole("button", { name: "Quitar de la comparación" });

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

test.describe("HU-041 — añadir y quitar de la comparación desde la ficha", () => {
  test("en la ficha de un curso fuera de la cesta, «Añadir» lo mete sin salir de la ficha", async ({
    page,
  }) => {
    const [curso] = await cursosDelBuscador(page, 1);
    await page.goto(`/curso/${curso.id}`);

    await botonAnadir(page).click();

    await expect(botonQuitar(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/curso/${curso.id}$`));
    await expect(barra(page)).toContainText("1 de 4");
    await expect(barra(page)).toContainText(curso.titulo);
  });

  test("en la ficha de un curso que ya está en la cesta, el botón lo quita", async ({ page }) => {
    await page.goto("/buscar");
    const casilla = page.locator('input[type="checkbox"][name="ids"]').first();
    const id = (await casilla.getAttribute("value"))!;
    await casilla.check();
    await expect(barra(page)).toContainText("1 de 4");

    await page.goto(`/curso/${id}`);
    await botonQuitar(page).click();

    await expect(botonAnadir(page)).toBeVisible();
    await expect(barra(page)).toHaveCount(0);
  });

  test("lo marcado en el buscador y lo añadido desde la ficha de otro se suman", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const primero = ((await page.locator("main li h2 a").first().textContent()) ?? "").trim();
    await page.locator('input[type="checkbox"][name="ids"]').first().check();
    await expect(barra(page)).toContainText("1 de 4");

    await page.locator("main li h2 a").nth(1).click();
    await expect(page).toHaveURL(/\/curso\//);
    const segundo = ((await page.getByRole("heading", { level: 1 }).textContent()) ?? "").trim();
    await botonAnadir(page).click();

    await expect(barra(page)).toContainText("2 de 4");
    await expect(barra(page)).toContainText(primero);
    await expect(barra(page)).toContainText(segundo);
  });

  test("con la cesta llena, el botón no está activo y se explica que hay que quitar uno", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const casillas = page.locator('input[type="checkbox"][name="ids"]');
    for (let i = 0; i < 4; i++) await casillas.nth(i).check();
    await expect(barra(page)).toContainText("4 de 4");
    const quinto = (await casillas.nth(4).getAttribute("value"))!;

    await page.goto(`/curso/${quinto}`);

    await expect(botonAnadir(page)).toBeDisabled();
    await expect(page.getByText(/Quita uno en la barra de abajo/i)).toBeVisible();
  });

  test("una dirección antigua con ?comparando= carga la ficha con normalidad", async ({ page }) => {
    const [curso, otro] = await cursosDelBuscador(page, 2);

    await page.goto(`/curso/${curso.id}?comparando=${otro.id}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(curso.titulo);
    await expect(botonAnadir(page)).toBeVisible();
    await expect(barra(page)).toHaveCount(0);
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("el botón de la ficha lleva a /buscar con ese curso ya marcado", async ({ page }) => {
      const [curso] = await cursosDelBuscador(page, 1);
      await page.goto(`/curso/${curso.id}`);

      await page.getByRole("link", { name: "Añadir a la comparación" }).click();

      await expect(page).toHaveURL(new RegExp(`/buscar\\?preseleccionado=${curso.id}`));
      await expect(
        page.locator(`input[type="checkbox"][name="ids"][value="${curso.id}"]`)
      ).toBeChecked();
    });
  });
});

test.describe("HU-041 — comparar desde favoritos", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  // Cuenta propia por test, con los favoritos sembrados directamente: guardar
  // uno a uno desde la ficha ya lo prueba HU-019 y aquí solo alargaría la
  // suite.
  async function conFavoritos(
    page: Page,
    context: BrowserContext,
    cuantos: number
  ): Promise<{ userId: string; cursos: Curso[] }> {
    const cursos = await cursosDelBuscador(page, cuantos);
    const correo = `zzz-hu041-e2e-${cuantos}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { userId } = await abrirSesion(context, correo);
    const { error } = await clienteAdmin()
      .from("favorites")
      .insert(cursos.map((c) => ({ user_id: userId, course_id: c.id })));
    if (error) {
      await borrarUsuario(userId);
      throw new Error(`No se pudieron sembrar los favoritos: ${error.message}`);
    }
    return { userId, cursos };
  }

  const tarjetaDe = (page: Page, id: string) =>
    page.locator("main li").filter({ has: page.locator(`a[href="/curso/${id}"]`) });

  test("cada tarjeta de favoritos añade y quita de la comparación, igual que la ficha", async ({
    page,
    context,
  }) => {
    const { userId, cursos } = await conFavoritos(page, context, 2);
    try {
      await page.goto("/favoritos");
      const tarjeta = tarjetaDe(page, cursos[0].id);

      await botonAnadir(tarjeta).click();
      await expect(botonQuitar(tarjeta)).toBeVisible();
      await expect(barra(page)).toContainText("1 de 4");
      await expect(barra(page)).toContainText(cursos[0].titulo);

      await botonQuitar(tarjeta).click();
      await expect(botonAnadir(tarjeta)).toBeVisible();
      await expect(barra(page)).toHaveCount(0);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("con entre 2 y 4 favoritos, «Comparar mis favoritos» lleva a su comparación", async ({
    page,
    context,
  }) => {
    const { userId, cursos } = await conFavoritos(page, context, 3);
    try {
      await page.goto("/favoritos");
      await page.getByRole("link", { name: "Comparar mis favoritos" }).click();

      await expect(page).toHaveURL(/\/comparar\?ids=/);
      await expect(page.locator("thead th")).toHaveCount(cursos.length + 1);
      expect((await page.locator("thead th a").allTextContents()).map((t) => t.trim())).toEqual(
        expect.arrayContaining(cursos.map((c) => c.titulo))
      );
      // Desde HU-042, abrir una comparación la adopta como cesta.
      await expect(barra(page)).toContainText(`${cursos.length} de 4`);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("con más de 4 favoritos no se ofrece; se eligen desde cada tarjeta", async ({
    page,
    context,
  }) => {
    const { userId, cursos } = await conFavoritos(page, context, 5);
    try {
      await page.goto("/favoritos");

      await expect(page.locator("main li")).toHaveCount(cursos.length);
      await expect(page.getByRole("link", { name: "Comparar mis favoritos" })).toHaveCount(0);
      await expect(botonAnadir(page)).toHaveCount(cursos.length);
    } finally {
      await borrarUsuario(userId);
    }
  });
});
