// @vitest-environment node
//
// HU-019. Lo que se comprueba aquí no es que la página filtre bien, sino que la
// **base de datos** aísle: se atacan los favoritos de otra persona con una
// sesión legítima, pidiendo sus filas explícitamente. Si la RLS de
// 0004_favorites.sql fallara, estos tests lo verían aunque el código de las
// páginas fuese perfecto.
//
// La clave de servicio solo se usa para crear y borrar los usuarios de prueba,
// nunca para las consultas que se están poniendo a prueba: esas van con la
// sesión de cada usuario, como en el navegador.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { guardarFavorito } from "../../src/lib/favorites/favorites.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configurado = supabaseUrl && anonKey && serviceKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const CORREO_A = `zzz-hu019-a-${SUFIJO}@example.com`;
const CORREO_B = `zzz-hu019-b-${SUFIJO}@example.com`;
const SOURCE_ID_A = `test-hu019-a-${SUFIJO}`;
const SOURCE_ID_B = `test-hu019-b-${SUFIJO}`;

describeIfConfigured("HU-019 — aislamiento de los favoritos", () => {
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;

  let sesionA: SupabaseClient;
  let sesionB: SupabaseClient;
  let usuarioA = "";
  let usuarioB = "";
  let cursoA = "";
  let cursoB = "";

  // Devuelve un cliente autenticado como ese usuario, igual que tendría el
  // navegador tras pulsar el enlace de acceso.
  async function sesionDe(correo: string): Promise<SupabaseClient> {
    const { data: enlace } = await admin!.auth.admin.generateLink({
      type: "magiclink",
      email: correo,
    });
    const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error } = await cliente.auth.verifyOtp({
      type: "magiclink",
      token_hash: enlace!.properties!.hashed_token,
    });
    if (error) throw new Error(`No se pudo abrir sesión de prueba: ${error.message}`);
    return cliente;
  }

  beforeAll(async () => {
    if (!admin) return;

    const { data: a } = await admin.auth.admin.createUser({
      email: CORREO_A,
      email_confirm: true,
    });
    const { data: b } = await admin.auth.admin.createUser({
      email: CORREO_B,
      email_confirm: true,
    });
    usuarioA = a!.user!.id;
    usuarioB = b!.user!.id;

    // Cursos marcados con prefijo `test-` para poder borrarlos al terminar
    // (excepción documentada en .claude/rules/testing.md).
    const { data: cursos, error } = await admin
      .from("courses")
      .insert([
        { source: "udemy", source_id: SOURCE_ID_A, title: "Curso de prueba A" },
        { source: "udemy", source_id: SOURCE_ID_B, title: "Curso de prueba B" },
      ])
      .select("id, source_id");
    if (error) throw new Error(`No se pudieron sembrar los cursos: ${error.message}`);

    cursoA = cursos!.find((c) => c.source_id === SOURCE_ID_A)!.id;
    cursoB = cursos!.find((c) => c.source_id === SOURCE_ID_B)!.id;

    sesionA = await sesionDe(CORREO_A);
    sesionB = await sesionDe(CORREO_B);

    // A guarda el curso A; B guarda el curso B.
    await sesionA.from("favorites").insert({ user_id: usuarioA, course_id: cursoA });
    await sesionB.from("favorites").insert({ user_id: usuarioB, course_id: cursoB });
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    for (const id of [usuarioA, usuarioB]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
    await admin.from("courses").delete().in("source_id", [SOURCE_ID_A, SOURCE_ID_B]);
  }, 60_000);

  it("cada usuario ve solo sus favoritos", async () => {
    const { data: deA } = await sesionA.from("favorites").select("course_id");
    const { data: deB } = await sesionB.from("favorites").select("course_id");

    expect(deA?.map((f) => f.course_id)).toEqual([cursoA]);
    expect(deB?.map((f) => f.course_id)).toEqual([cursoB]);
  }, 30_000);

  // El caso que de verdad importa: no basta con que la consulta normal filtre,
  // tiene que fallar también cuando se pide adrede lo ajeno.
  it("pedir explícitamente los favoritos de otro no devuelve nada", async () => {
    const { data, error } = await sesionA
      .from("favorites")
      .select("course_id")
      .eq("user_id", usuarioB);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  }, 30_000);

  it("no se puede borrar el favorito de otro", async () => {
    await sesionA.from("favorites").delete().eq("user_id", usuarioB);

    // B sigue teniendo el suyo: el borrado no alcanzó a otra cuenta.
    const { data } = await sesionB.from("favorites").select("course_id");
    expect(data?.map((f) => f.course_id)).toEqual([cursoB]);
  }, 30_000);

  it("no se puede guardar un favorito a nombre de otro", async () => {
    const { error } = await sesionA
      .from("favorites")
      .insert({ user_id: usuarioB, course_id: cursoA });

    // La política `with check` lo rechaza; no es que se guarde y luego no se vea.
    expect(error).not.toBeNull();

    const { data } = await sesionB.from("favorites").select("course_id");
    expect(data?.map((f) => f.course_id)).toEqual([cursoB]);
  }, 30_000);

  // Este test comprobaba solo que no hubiera dos filas, y pasaba aunque el
  // segundo guardado fallara: contar 1 no distingue "no duplicó" de "no llegó a
  // guardar". Sin mirar el error, el fallo real —RLS rechazando el
  // `ON CONFLICT DO UPDATE`— quedaba invisible.
  it("guardar dos veces el mismo curso no duplica ni falla", async () => {
    // Se llama a la función de producción, no a un upsert escrito aquí: si
    // mañana cambia cómo guarda, este test sigue cubriendo lo que importa.
    await expect(guardarFavorito(sesionA, usuarioA, cursoA)).resolves.toBeUndefined();

    const { data } = await sesionA.from("favorites").select("course_id").eq("course_id", cursoA);
    expect(data).toHaveLength(1);
  }, 30_000);

  // Sin sesión no hay ninguna política que aplique, así que no se ve nada.
  it("sin sesión no se ve ningún favorito", async () => {
    const anonimo = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data } = await anonimo.from("favorites").select("course_id");

    expect(data ?? []).toEqual([]);
  }, 30_000);

  // Si se borra la cuenta, sus favoritos se van con ella (on delete cascade).
  it("al borrar la cuenta desaparecen sus favoritos", async () => {
    const { data: efimero } = await admin!.auth.admin.createUser({
      email: `zzz-hu019-c-${SUFIJO}@example.com`,
      email_confirm: true,
    });
    const id = efimero!.user!.id;

    const sesionC = await sesionDe(`zzz-hu019-c-${SUFIJO}@example.com`);
    await sesionC.from("favorites").insert({ user_id: id, course_id: cursoA });

    await admin!.auth.admin.deleteUser(id);

    const { count } = await admin!
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);
    expect(count).toBe(0);
  }, 60_000);
});
