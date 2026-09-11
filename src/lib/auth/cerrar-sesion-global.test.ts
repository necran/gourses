import { describe, expect, it, vi } from "vitest";
import { cerrarSesionGlobalConCliente } from "./cerrar-sesion-global";
import type { SupabaseClient } from "@supabase/supabase-js";

function clienteFalso(respuesta: { error: { message: string } | null }) {
  const signOut = vi.fn(() => Promise.resolve(respuesta));
  const client = { auth: { signOut } } as unknown as SupabaseClient;
  return { client, signOut };
}

describe("cerrarSesionGlobalConCliente", () => {
  it("pide el cierre con scope global, no el local por defecto", async () => {
    const { client, signOut } = clienteFalso({ error: null });
    await cerrarSesionGlobalConCliente(client);

    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("sin error, no devuelve ninguno", async () => {
    const { client } = clienteFalso({ error: null });
    await expect(cerrarSesionGlobalConCliente(client)).resolves.toEqual({});
  });

  // Si Supabase no pudo revocar los tokens, decirlo es mejor que dejar creer
  // que el acceso se ha cortado en todas partes cuando puede que no.
  it("si falla, devuelve un error y no dice que ha funcionado", async () => {
    const { client } = clienteFalso({ error: { message: "boom, detalle interno" } });
    const resultado = await cerrarSesionGlobalConCliente(client);

    expect(resultado.error).toBeTruthy();
    // El mensaje de Supabase no sale tal cual: puede traer detalles internos.
    expect(resultado.error).not.toMatch(/boom/);
  });
});
