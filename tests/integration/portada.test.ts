// @vitest-environment node
//
// HU-012. Misma excepción documentada que en HU-007 (ver .claude/rules/testing.md):
// se consulta la base de dev por el mismo camino que producción, pero aquí solo
// se lee y no se siembra nada.
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getCatalogSummary } from "../../src/lib/courses/catalog-summary";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = supabaseUrl && anonKey ? describe : describe.skip;

describeIfConfigured("HU-012 — resumen del catálogo para la portada", () => {
  it("devuelve las cifras reales del catálogo", async () => {
    const client = createClient(supabaseUrl!, anonKey!);
    const resumen = await getCatalogSummary(client);

    expect(resumen).not.toBeNull();
    expect(resumen!.courseCount).toBeGreaterThan(0);
    expect(resumen!.sourceCount).toBeGreaterThan(0);
    // No puede prometer más plataformas de las que existen en el esquema.
    expect(resumen!.sourceCount).toBeLessThanOrEqual(2);
  }, 30_000);

  // Criterio de aceptación: la portada tiene que servirse igual aunque la base
  // no responda. Las cifras son decoración, no el contenido.
  it("devuelve null en vez de lanzar si la base de datos no responde", async () => {
    const client = createClient("http://127.0.0.1:9", anonKey!);
    const resumen = await getCatalogSummary(client);

    expect(resumen).toBeNull();
  }, 30_000);

  it("devuelve null en vez de lanzar si las credenciales no valen", async () => {
    const client = createClient(supabaseUrl!, "clave-invalida");
    const resumen = await getCatalogSummary(client);

    expect(resumen).toBeNull();
  }, 30_000);
});
