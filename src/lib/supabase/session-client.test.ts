// La cookie de sesión lleva el token de refresco, que dura meses. @supabase/ssr
// la marca `httpOnly: false` por defecto, pensando en apps que leen la sesión
// desde el navegador; esta no lo hace. Ese default puede volver sin avisar en
// una actualización de la librería, así que se fija por test.
//
// Aquí se sustituye `createServerClient` a propósito: lo que se comprueba no es
// el comportamiento de Supabase, sino la configuración que le pasamos nosotros,
// que es justo lo que puede regresar.
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerClient = vi.fn(() => ({ auth: {} }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...(args as [])),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

describe("HU-018 — cookies del cliente de sesión", () => {
  beforeEach(() => {
    createServerClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "clave-anonima-de-prueba";
  });

  async function opcionesDeCookie() {
    const { createSupabaseSessionClient } = await import("./session-client.ts");
    await createSupabaseSessionClient();
    const [, , opciones] = createServerClient.mock.calls[0] as unknown as [
      string,
      string,
      { cookieOptions?: Record<string, unknown> },
    ];
    return opciones.cookieOptions;
  }

  it("no deja la cookie de sesión al alcance de JavaScript", async () => {
    expect(await opcionesDeCookie()).toMatchObject({ httpOnly: true });
  });

  it("exige HTTPS en producción", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await opcionesDeCookie()).toMatchObject({ secure: true });
    vi.unstubAllEnvs();
  });

  // En el NAS el sitio se sirve por http://, donde una cookie `secure` no
  // viaja: exigirla en desarrollo dejaría el acceso roto en local.
  it("no exige HTTPS fuera de producción", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await opcionesDeCookie()).toMatchObject({ secure: false });
    vi.unstubAllEnvs();
  });

  it("no envía la cookie en peticiones desde otros sitios", async () => {
    expect(await opcionesDeCookie()).toMatchObject({ sameSite: "lax" });
  });
});
