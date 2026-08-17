import { describe, expect, it, vi } from "vitest";
import { esFavorito, guardarFavorito, listarFavoritos, quitarFavorito } from "./favorites";
import type { SupabaseClient } from "@supabase/supabase-js";

const ID_VALIDO = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const USUARIO = "8d1b2c3f-1111-4222-8333-444455556666";

// Ids que no pueden corresponder a ningún curso. El interés no es solo que se
// rechacen, sino que se rechacen **antes** de consultar: lo que nunca llega a la
// base de datos no puede hacerle nada.
const IDS_INVALIDOS = [
  "",
  "no-soy-un-uuid",
  "' or 1=1 --",
  "3f2504e0-4f89-41d3-9a0c-0305e82c3301,otro",
];

// Cliente que grita si alguien lo usa: cualquier consulta con un id inválido
// hace fallar el test en lugar de pasar desapercibida.
function clienteQueNoDebeUsarse(): SupabaseClient {
  return {
    from: () => {
      throw new Error("No se debe consultar la base de datos con un id inválido");
    },
  } as unknown as SupabaseClient;
}

// Cliente mínimo que devuelve lo que se le diga, para las rutas válidas.
function clienteFalso(respuesta: { data: unknown; error: unknown }) {
  const constructor = {
    select: vi.fn(() => constructor),
    eq: vi.fn(() => constructor),
    order: vi.fn(() => Promise.resolve(respuesta)),
    maybeSingle: vi.fn(() => Promise.resolve(respuesta)),
    upsert: vi.fn(() => Promise.resolve(respuesta)),
    delete: vi.fn(() => constructor),
  };
  const client = { from: vi.fn(() => constructor) } as unknown as SupabaseClient;
  return { client, constructor };
}

describe("HU-019 — favoritos", () => {
  describe("un identificador inválido no llega a la base de datos", () => {
    it("esFavorito responde que no, sin consultar", async () => {
      for (const id of IDS_INVALIDOS) {
        await expect(esFavorito(clienteQueNoDebeUsarse(), id)).resolves.toBe(false);
      }
    });

    it("guardarFavorito falla sin consultar", async () => {
      for (const id of IDS_INVALIDOS) {
        await expect(guardarFavorito(clienteQueNoDebeUsarse(), USUARIO, id)).rejects.toThrow(
          /no válido/i
        );
      }
    });

    it("quitarFavorito falla sin consultar", async () => {
      for (const id of IDS_INVALIDOS) {
        await expect(quitarFavorito(clienteQueNoDebeUsarse(), id)).rejects.toThrow(/no válido/i);
      }
    });
  });

  describe("lectura", () => {
    it("una lista vacía no consulta los cursos", async () => {
      const { client, constructor } = clienteFalso({ data: [], error: null });
      await expect(listarFavoritos(client)).resolves.toEqual([]);
      // Solo la consulta de favoritos; no se pide ningún curso.
      expect(constructor.select).toHaveBeenCalledTimes(1);
    });

    it("esFavorito distingue entre encontrado y no encontrado", async () => {
      const conFila = clienteFalso({ data: { course_id: ID_VALIDO }, error: null });
      await expect(esFavorito(conFila.client, ID_VALIDO)).resolves.toBe(true);

      const sinFila = clienteFalso({ data: null, error: null });
      await expect(esFavorito(sinFila.client, ID_VALIDO)).resolves.toBe(false);
    });

    // Un fallo de la base de datos no puede confundirse con "no es favorito":
    // se propaga en vez de devolver un false que parecería normal.
    it("un error al leer no se disfraza de 'no es favorito'", async () => {
      const { client } = clienteFalso({ data: null, error: { message: "boom" } });
      await expect(esFavorito(client, ID_VALIDO)).rejects.toThrow(/comprobar el favorito/i);
    });
  });

  describe("escritura", () => {
    // `ignoreDuplicates` no es un detalle de estilo: sin él, PostgREST manda
    // `ON CONFLICT DO UPDATE`, y como la tabla no tiene política de UPDATE (una
    // fila de favoritos no tiene nada que actualizar), el segundo guardado del
    // mismo curso falla con un error de RLS. Se fija aquí para que no se pierda
    // en un refactor; el efecto real se comprueba contra la base de datos en
    // tests/integration/favoritos.test.ts.
    it("guardar no rompe si el curso ya estaba guardado", async () => {
      const { client, constructor } = clienteFalso({ data: null, error: null });
      await guardarFavorito(client, USUARIO, ID_VALIDO);

      expect(constructor.upsert).toHaveBeenCalledWith(
        { user_id: USUARIO, course_id: ID_VALIDO },
        { onConflict: "user_id,course_id", ignoreDuplicates: true }
      );
    });

    // Quien decide qué se puede borrar es la RLS. Si además se filtrara por
    // usuario aquí, el test seguiría pasando, pero la protección real quedaría
    // escondida detrás de un filtro que alguien podría quitar sin enterarse.
    it("quitar filtra por curso y deja el dueño a la RLS", async () => {
      const { client, constructor } = clienteFalso({ data: null, error: null });
      await quitarFavorito(client, ID_VALIDO);

      expect(constructor.delete).toHaveBeenCalled();
      expect(constructor.eq).toHaveBeenCalledWith("course_id", ID_VALIDO);
      expect(constructor.eq).toHaveBeenCalledTimes(1);
    });

    it("un error al guardar se propaga", async () => {
      const { client } = clienteFalso({ data: null, error: { message: "boom" } });
      await expect(guardarFavorito(client, USUARIO, ID_VALIDO)).rejects.toThrow(
        /guardar el favorito/i
      );
    });
  });
});
