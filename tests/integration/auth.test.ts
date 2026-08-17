// @vitest-environment node
//
// HU-018. Comprueba el flujo de acceso contra el Supabase real, sin depender
// de que llegue un correo: se genera el enlace con la API de administración y
// se canjea, que es exactamente lo que hace el usuario al pulsarlo.
//
// La clave de servicio solo se usa aquí, en un test de servidor. Nunca aparece
// en código alcanzable desde una página (ver .claude/rules/seguridad.md).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configurado = supabaseUrl && anonKey && serviceKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const CORREO = `zzz-hu018-test-${Date.now()}@example.com`;

describeIfConfigured("HU-018 — acceso por enlace mágico", () => {
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;

  // `generateLink` con tipo "magiclink" exige que el usuario ya exista. En
  // producción eso lo resuelve `signInWithOtp`, que lo crea si hace falta; aquí
  // se crea explícitamente para poder pedir el enlace.
  beforeAll(async () => {
    if (!admin) return;
    await admin.auth.admin.createUser({ email: CORREO, email_confirm: true });
  });

  afterAll(async () => {
    if (!admin) return;
    const { data } = await admin.auth.admin.listUsers();
    for (const u of data?.users ?? []) {
      if (u.email?.startsWith("zzz-hu018-test-")) {
        await admin.auth.admin.deleteUser(u.id);
      }
    }
  });

  it("un enlace de acceso permite establecer sesión y devuelve al usuario correcto", async () => {
    const { data: enlace, error: errorEnlace } = await admin!.auth.admin.generateLink({
      type: "magiclink",
      email: CORREO,
    });

    expect(errorEnlace).toBeNull();
    expect(enlace?.properties?.hashed_token).toBeTruthy();

    // Se canjea con la clave anónima, como haría el navegador.
    const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data: sesion, error } = await cliente.auth.verifyOtp({
      type: "magiclink",
      token_hash: enlace!.properties!.hashed_token,
    });

    expect(error).toBeNull();
    expect(sesion.user?.email).toBe(CORREO);
    expect(sesion.session?.access_token).toBeTruthy();
  }, 30_000);

  it("un enlace ya usado no vuelve a servir", async () => {
    const { data: enlace } = await admin!.auth.admin.generateLink({
      type: "magiclink",
      email: CORREO,
    });
    const token = enlace!.properties!.hashed_token;

    const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const primero = await cliente.auth.verifyOtp({ type: "magiclink", token_hash: token });
    expect(primero.error).toBeNull();

    const segundo = await cliente.auth.verifyOtp({ type: "magiclink", token_hash: token });
    expect(segundo.error).not.toBeNull();
  }, 30_000);

  it("un token inventado no establece sesión", async () => {
    const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await cliente.auth.verifyOtp({
      type: "magiclink",
      token_hash: "token-completamente-inventado",
    });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  }, 30_000);

  // La clave anónima no puede administrar usuarios: si pudiera, cualquiera con
  // el código del navegador podría listar los correos registrados.
  it("la clave anónima no puede listar usuarios", async () => {
    const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await cliente.auth.admin.listUsers();

    expect(error).not.toBeNull();
    expect(data?.users ?? []).toHaveLength(0);
  }, 30_000);
});
