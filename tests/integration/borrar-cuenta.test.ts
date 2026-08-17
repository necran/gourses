// @vitest-environment node
//
// HU-020. La función `borrar_mi_cuenta` corre con privilegios elevados
// (`security definer`), así que lo que hay que demostrar no es que borre, sino
// que **no pueda borrar a nadie más**. Si estuviera mal atada, sería una forma
// de que cualquiera con cuenta eliminara las de los demás.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configurado = supabaseUrl && anonKey && serviceKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const SOURCE_ID = `test-hu020-${SUFIJO}`;

describeIfConfigured("HU-020 — borrado de la propia cuenta", () => {
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;

  let cursoId = "";
  const creados: string[] = [];

  async function nuevoUsuario(etiqueta: string) {
    const correo = `zzz-hu020-${etiqueta}-${SUFIJO}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const { data } = await admin!.auth.admin.createUser({ email: correo, email_confirm: true });
    const id = data!.user!.id;
    creados.push(id);

    const { data: enlace } = await admin!.auth.admin.generateLink({
      type: "magiclink",
      email: correo,
    });
    const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error } = await cliente.auth.verifyOtp({
      type: "magiclink",
      token_hash: enlace!.properties!.hashed_token,
    });
    if (error) throw new Error(`No se pudo abrir sesión: ${error.message}`);

    return { id, correo, cliente };
  }

  async function existe(id: string): Promise<boolean> {
    const { data } = await admin!.auth.admin.getUserById(id);
    return Boolean(data?.user);
  }

  beforeAll(async () => {
    if (!admin) return;
    const { data } = await admin
      .from("courses")
      .insert({ source: "udemy", source_id: SOURCE_ID, title: "Curso de prueba HU-020" })
      .select("id")
      .single();
    cursoId = data!.id;
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    for (const id of creados) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    await admin.from("courses").delete().eq("source_id", SOURCE_ID);
  }, 60_000);

  it("borra la cuenta de quien llama", async () => {
    const a = await nuevoUsuario("propia");

    const { error } = await a.cliente.rpc("borrar_mi_cuenta");

    expect(error).toBeNull();
    expect(await existe(a.id)).toBe(false);
  }, 60_000);

  // El caso que justifica toda la precaución del `security definer`.
  it("no puede borrar la cuenta de otra persona", async () => {
    const a = await nuevoUsuario("atacante");
    const b = await nuevoUsuario("victima");

    // La función no acepta argumentos a propósito: no hay a quién apuntar. Aun
    // así se intenta pasarle uno, por si alguien añadiera una sobrecarga.
    await a.cliente.rpc("borrar_mi_cuenta", { user_id: b.id } as never);

    expect(await existe(b.id)).toBe(true);
  }, 60_000);

  it("sin sesión no borra a nadie", async () => {
    const b = await nuevoUsuario("intacto");
    const anonimo = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });

    await anonimo.rpc("borrar_mi_cuenta");

    expect(await existe(b.id)).toBe(true);
  }, 60_000);

  it("al borrarse la cuenta desaparecen sus favoritos", async () => {
    const a = await nuevoUsuario("confavoritos");
    await a.cliente.from("favorites").insert({ user_id: a.id, course_id: cursoId });

    const { count: antes } = await admin!
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", a.id);
    expect(antes).toBe(1);

    await a.cliente.rpc("borrar_mi_cuenta");

    const { count: despues } = await admin!
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", a.id);
    expect(despues).toBe(0);
  }, 60_000);

  // El curso en sí es del catálogo, no de la persona: borrar la cuenta no puede
  // llevárselo por delante.
  it("borrar la cuenta no borra los cursos del catálogo", async () => {
    const { data } = await admin!.from("courses").select("id").eq("id", cursoId).maybeSingle();
    expect(data).not.toBeNull();
  }, 30_000);
});
