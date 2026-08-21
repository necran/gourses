// @vitest-environment node
//
// HU-024. Lo que se pone a prueba aquí no es el formato del fichero —eso ya lo
// cubren los unitarios— sino que la exportación **no pueda arrastrar datos de
// otra persona**. Es el riesgo propio de esta función: junta en un solo sitio
// todo lo que hay sobre alguien, así que un fallo de aislamiento aquí no filtra
// una fila, filtra el expediente entero.
//
// Por eso se arma con sesiones reales y se comprueba contra la RLS de verdad,
// no con dobles.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { listarFavoritos } from "../../src/lib/favorites/favorites.ts";
import { avisosActivados } from "../../src/lib/alertas/preferencias.ts";
import { componerExportacion } from "../../src/lib/cuenta/exportacion.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configurado = supabaseUrl && anonKey && serviceKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const CORREO_A = `zzz-hu024-a-${SUFIJO}@example.com`;
const CORREO_B = `zzz-hu024-b-${SUFIJO}@example.com`;
const SOURCE_ID_A = `test-hu024-a-${SUFIJO}`;
const SOURCE_ID_B = `test-hu024-b-${SUFIJO}`;

const TITULO_A = `Curso privado de A ${SUFIJO}`;
const TITULO_B = `Curso privado de B ${SUFIJO}`;

describeIfConfigured("HU-024 — exportación de los datos propios", () => {
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;

  let sesionA: SupabaseClient;
  let sesionB: SupabaseClient;
  let usuarioA = "";
  let usuarioB = "";
  let cursoA = "";
  let cursoB = "";

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

  // Arma la exportación igual que la ruta: mismas funciones, misma sesión.
  async function exportarCon(cliente: SupabaseClient, correo: string) {
    const [favoritos, avisos] = await Promise.all([
      listarFavoritos(cliente),
      avisosActivados(cliente),
    ]);
    return componerExportacion({
      correo,
      altaEn: "2026-01-01T00:00:00.000Z",
      avisosDeBajadaDePrecio: avisos,
      favoritos,
    });
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

    // Cursos con prefijo `test-` para poder borrarlos al terminar (excepción
    // documentada en .claude/rules/testing.md).
    const { data: cursos, error } = await admin
      .from("courses")
      .insert([
        { source: "udemy", source_id: SOURCE_ID_A, title: TITULO_A, price_amount: 19.99, price_currency: "EUR" },
        { source: "udemy", source_id: SOURCE_ID_B, title: TITULO_B, price_amount: 9.99, price_currency: "EUR" },
      ])
      .select("id, source_id");
    if (error) throw new Error(`No se pudieron sembrar los cursos: ${error.message}`);

    cursoA = cursos!.find((c) => c.source_id === SOURCE_ID_A)!.id;
    cursoB = cursos!.find((c) => c.source_id === SOURCE_ID_B)!.id;

    sesionA = await sesionDe(CORREO_A);
    sesionB = await sesionDe(CORREO_B);

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

  it("exporta los favoritos propios con sus datos", async () => {
    const datos = await exportarCon(sesionA, CORREO_A);

    expect(datos.cuenta.correo).toBe(CORREO_A);
    expect(datos.favoritos).toHaveLength(1);
    expect(datos.favoritos[0].titulo).toBe(TITULO_A);
    expect(datos.favoritos[0].precio).toEqual({ importe: 19.99, divisa: "EUR" });
  }, 30_000);

  // El caso que justifica este fichero de tests.
  it("no incluye absolutamente nada de otra persona", async () => {
    const datos = await exportarCon(sesionA, CORREO_A);

    // Se busca en el fichero serializado entero, no solo en la lista: si algún
    // día se añadiera una sección nueva que colara datos ajenos, este test lo
    // vería igualmente.
    const texto = JSON.stringify(datos);

    expect(texto).not.toContain(TITULO_B);
    expect(texto).not.toContain(CORREO_B);
    expect(texto).not.toContain(usuarioB);
  }, 30_000);

  it("recoge la preferencia de avisos de quien exporta, no la de otro", async () => {
    // A la desactiva; B la deja como estaba (activada por defecto).
    await sesionA
      .from("alert_preferences")
      .upsert({ user_id: usuarioA, price_alerts_enabled: false }, { onConflict: "user_id" });

    const deA = await exportarCon(sesionA, CORREO_A);
    const deB = await exportarCon(sesionB, CORREO_B);

    expect(deA.preferencias.avisosDeBajadaDePrecio).toBe(false);
    expect(deB.preferencias.avisosDeBajadaDePrecio).toBe(true);
  }, 30_000);

  // Sin sesión no hay ninguna política que aplique, así que no se ve nada. La
  // ruta además redirige antes de llegar aquí, pero conviene que la capa de
  // datos tampoco entregue nada por su cuenta.
  it("sin sesión no sale ningún dato", async () => {
    const anonimo = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const datos = await exportarCon(anonimo, "");

    expect(datos.favoritos).toEqual([]);
  }, 30_000);
});
