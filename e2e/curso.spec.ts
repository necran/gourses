import { expect, test } from "@playwright/test";
import { Client } from "pg";

test.describe("HU-008 — ficha de curso", () => {
  test("desde un resultado de búsqueda se llega a la ficha con todos sus datos", async ({
    page,
  }) => {
    await page.goto("/buscar");

    const primero = page.locator("main li h2 a").first();
    const titulo = (await primero.textContent())?.trim();
    await primero.click();

    await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo!);

    // Fuente e imagen forman parte del criterio de aceptación.
    const main = page.locator("main");
    await expect(main).toContainText(/udemy|coursera/i);
    await expect(page.locator("main img").first()).toBeVisible();
  });

  test("el botón principal enlaza a la url de afiliado de la plataforma, no a una url genérica", async ({
    page,
  }) => {
    await page.goto("/buscar");
    await page.locator("main li h2 a").first().click();

    const boton = page.getByRole("link", { name: /^Ver curso en/i });
    await expect(boton).toBeVisible();

    const href = await boton.getAttribute("href");
    expect(href).toMatch(/^https:\/\/(www\.udemy\.com|www\.coursera\.org)\//);

    // Enlace saliente hacia un tercero: no debe ceder control de la pestaña.
    expect(await boton.getAttribute("rel")).toContain("noopener");
    expect(await boton.getAttribute("target")).toBe("_blank");
  });

  // HU-010: la ficha muestra la categoría del vocabulario común, con su
  // etiqueta legible y no con el identificador interno.
  test("la ficha muestra la categoría del curso", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu010-e2e-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, category, affiliate_url)
         values ('udemy', $1, 'Curso HU-010 con categoría', 'datos-e-ia', 'https://www.udemy.com/course/hu010/')
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      await expect(page.locator("main")).toContainText("Datos e IA");
      await expect(page.locator("main")).not.toContainText("datos-e-ia");
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });

  // HU-011: el rango se muestra tal cual, sin reducirlo a un punto medio que
  // la plataforma nunca ha publicado. Y sin duración, no se muestra nada.
  test("la ficha muestra el rango de duración, y nada cuando no la hay", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar los cursos");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu011-e2e-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, duration_min_minutes, duration_max_minutes)
         values ('coursera', $1, 'Curso HU-011 con rango', 480, 960),
                ('coursera', $2, 'Curso HU-011 sin duración', null, null)
         returning id, source_id`,
        [`${sourceId}-rango`, `${sourceId}-sin`]
      );
      const conRango = rows.find((r) => r.source_id === `${sourceId}-rango`)!.id;
      const sinDuracion = rows.find((r) => r.source_id === `${sourceId}-sin`)!.id;

      await page.goto(`/curso/${conRango}`);
      await expect(page.locator("main")).toContainText("8 h–16 h");

      await page.goto(`/curso/${sinDuracion}`);
      await expect(page.locator("main")).not.toContainText("⏱");
    } finally {
      await client.query(`delete from courses where source_id like $1`, [`${sourceId}%`]);
      await client.end();
    }
  });

  // Cuarto criterio de aceptación. No hay ninguna bajada de precio real en el
  // catálogo ingerido todavía, así que se siembra una y se limpia después
  // (misma excepción documentada en .claude/rules/testing.md que en HU-007).
  test("un curso cuyo precio ha bajado muestra el precio anterior tachado", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar la bajada de precio");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu008-e2e-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses
          (source, source_id, title, price_amount, price_currency, affiliate_url)
         values ('udemy', $1, 'Curso HU-008 con rebaja', 19.99, 'EUR', 'https://www.udemy.com/course/hu008-e2e/')
         returning id`,
        [sourceId]
      );
      const id = rows[0].id;

      await client.query(
        `insert into course_price_history (course_id, price_amount, price_currency, captured_at)
         values ($1, 39.99, 'EUR', now() - interval '7 days'),
                ($1, 19.99, 'EUR', now())`,
        [id]
      );

      await page.goto(`/curso/${id}`);

      await expect(page.locator("s")).toHaveText("39.99 EUR");
      await expect(page.locator("main")).toContainText("19.99 EUR");
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });

  test("una ficha con identificador inexistente muestra 'curso no encontrado'", async ({
    page,
  }) => {
    await page.goto("/curso/00000000-0000-4000-8000-000000000000");

    await expect(page.getByRole("heading", { name: "Curso no encontrado" })).toBeVisible();
  });

  test("una ficha con identificador malformado también muestra 'curso no encontrado'", async ({
    page,
  }) => {
    await page.goto("/curso/no-soy-un-identificador");

    await expect(page.getByRole("heading", { name: "Curso no encontrado" })).toBeVisible();
  });
});
