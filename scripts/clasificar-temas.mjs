// Rellena la columna `temas` de los cursos ya guardados (HU-058), con la misma
// función que usa la ingesta para los nuevos. Hace falta una vez tras aplicar la
// migración 0011, en desarrollo y en producción, y cada vez que cambie la lista
// de temas o sus patrones: la ingesta solo recalcula los cursos que vuelve a
// recorrer.
//
// Idempotente: solo escribe los cursos cuyos temas cambian. Al terminar informa
// de cuántos cursos tiene cada tema y de si supera el umbral de las páginas.
//
//   npm run clasificar:temas
import { Pool } from "pg";
import {
  RESENAS_MINIMAS,
  TEMAS,
  superaUmbral,
  temasDelTitulo,
} from "../src/lib/courses/temas.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}

const LOTE = 1000;
const pool = new Pool({ connectionString: databaseUrl, max: 2 });

const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

try {
  let desdeId = "00000000-0000-0000-0000-000000000000";
  let revisados = 0;
  let cambiados = 0;

  // Por lotes y ordenado por id: sin cargar 15.000 filas de una vez, y sin
  // saltarse ninguna aunque haya escrituras entre lote y lote.
  for (;;) {
    const { rows } = await pool.query(
      "select id, title, temas from courses where id > $1 order by id limit $2",
      [desdeId, LOTE]
    );
    if (rows.length === 0) break;

    const cambios = rows
      .map((r) => ({ id: r.id, antes: r.temas ?? [], ahora: temasDelTitulo(r.title) }))
      .filter((c) => !iguales(c.antes, c.ahora));

    if (cambios.length > 0) {
      await pool.query(
        `update courses as c set temas = v.temas
           from (select unnest($1::uuid[]) as id, unnest($2::text[]) as temas_json) as u
           cross join lateral (select array(select jsonb_array_elements_text(u.temas_json::jsonb)) as temas) as v
          where c.id = u.id`,
        [cambios.map((c) => c.id), cambios.map((c) => JSON.stringify(c.ahora))]
      );
    }

    revisados += rows.length;
    cambiados += cambios.length;
    desdeId = rows.at(-1).id;
  }

  console.log(`Cursos revisados: ${revisados} · con temas cambiados: ${cambiados}`);

  const { rows: recuentos } = await pool.query(
    `select t.tema,
            count(*) filter (where c.language = 'es') as en_espanol,
            count(*) filter (where c.language = 'es' and c.num_reviews >= $2) as con_resenas,
            count(*) as total
       from courses c cross join lateral unnest(c.temas) as t(tema)
      where c.temas && $1::text[]
      group by t.tema`,
    [TEMAS, RESENAS_MINIMAS]
  );
  const porTema = new Map(recuentos.map((r) => [r.tema, r]));

  console.log("\nTema                           en español  con reseñas   total  ¿página indexable?");
  for (const tema of TEMAS) {
    const r = porTema.get(tema);
    const recuento = { enEspanol: Number(r?.en_espanol ?? 0), enEspanolConResenas: Number(r?.con_resenas ?? 0) };
    console.log(
      `${tema.padEnd(30)} ${String(recuento.enEspanol).padStart(10)}  ${String(recuento.enEspanolConResenas).padStart(11)}  ${String(r?.total ?? 0).padStart(6)}  ${superaUmbral(recuento) ? "sí" : "no"}`
    );
  }
} finally {
  await pool.end();
}
