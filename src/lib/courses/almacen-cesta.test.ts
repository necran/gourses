import { describe, expect, it, vi } from "vitest";
import { crearAlmacenCesta } from "./almacen-cesta";
import { CLAVE_CESTA, anadir, quitar } from "./cesta-comparar";

const A = { id: "a1b2c3d4-0000-4000-8000-000000000001", titulo: "Python" };
const B = { id: "a1b2c3d4-0000-4000-8000-000000000002", titulo: "Rust" };

function almacenamientoFalso(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (clave) => void datos.delete(clave),
    setItem: (clave, valor) => void datos.set(clave, String(valor)),
  };
}

const bloqueado = () => {
  throw new DOMException("Almacenamiento bloqueado", "SecurityError");
};

describe("crearAlmacenCesta", () => {
  it("guarda en el almacenamiento y otra instancia (una recarga) lo lee", () => {
    const storage = almacenamientoFalso();
    crearAlmacenCesta(() => storage, null).actualizar((c) => anadir(c, A));

    expect(storage.getItem(CLAVE_CESTA)).toContain(A.id);
    expect(crearAlmacenCesta(() => storage, null).obtener()).toEqual([A]);
  });

  it("lo guardado corrupto se lee como cesta vacía", () => {
    const storage = almacenamientoFalso();
    storage.setItem(CLAVE_CESTA, "{roto");
    expect(crearAlmacenCesta(() => storage, null).obtener()).toEqual([]);
  });

  it("avisa a quien escucha cuando cambia, y no cuando no cambia nada", () => {
    const almacen = crearAlmacenCesta(almacenamientoFalso, null);
    const oyente = vi.fn();
    almacen.suscribir(oyente);

    almacen.actualizar((c) => anadir(c, A));
    almacen.actualizar((c) => anadir(c, A));
    almacen.actualizar((c) => quitar(c, B.id));

    expect(oyente).toHaveBeenCalledTimes(1);
    expect(almacen.obtenerAnuncio()).toMatch(/Añadido a la comparación: Python/);
  });

  it("la misma cesta se devuelve mientras no cambie (lo exige useSyncExternalStore)", () => {
    const almacen = crearAlmacenCesta(almacenamientoFalso, null);
    almacen.actualizar((c) => anadir(c, A));
    expect(almacen.obtener()).toBe(almacen.obtener());
  });

  it("con el almacenamiento bloqueado funciona en memoria, sin lanzar", () => {
    const almacen = crearAlmacenCesta(bloqueado, null);

    expect(almacen.obtener()).toEqual([]);
    expect(() => almacen.actualizar((c) => anadir(c, A))).not.toThrow();
    expect(almacen.obtener()).toEqual([A]);
  });

  it("si leer funciona pero guardar falla (sin espacio), se queda en memoria", () => {
    const storage = almacenamientoFalso();
    storage.setItem = bloqueado;
    const almacen = crearAlmacenCesta(() => storage, null);

    expect(() => almacen.actualizar((c) => anadir(c, A))).not.toThrow();
    expect(almacen.obtener()).toEqual([A]);
  });

  describe("otras pestañas", () => {
    function dosPestanas() {
      const storage = almacenamientoFalso();
      const eventos = new EventTarget();
      return {
        eventos,
        esta: crearAlmacenCesta(() => storage, eventos),
        otra: crearAlmacenCesta(() => storage, null),
      };
    }

    it("un cambio en otra pestaña se refleja y avisa", () => {
      const { eventos, esta, otra } = dosPestanas();
      const oyente = vi.fn();
      esta.suscribir(oyente);
      expect(esta.obtener()).toEqual([]);

      otra.actualizar((c) => anadir(c, A));
      eventos.dispatchEvent(new StorageEvent("storage", { key: CLAVE_CESTA }));

      expect(oyente).toHaveBeenCalledTimes(1);
      expect(esta.obtener()).toEqual([A]);
    });

    it("un clear() completo también cuenta; otra clave no", () => {
      const { eventos, esta } = dosPestanas();
      const oyente = vi.fn();
      esta.suscribir(oyente);

      eventos.dispatchEvent(new StorageEvent("storage", { key: "otra-cosa" }));
      expect(oyente).not.toHaveBeenCalled();

      eventos.dispatchEvent(new StorageEvent("storage", { key: null }));
      expect(oyente).toHaveBeenCalledTimes(1);
    });

    it("sin nadie escuchando deja de atender, y al volver a escuchar lee lo último", () => {
      const { eventos, esta, otra } = dosPestanas();
      const oyente = vi.fn();
      const dejar = esta.suscribir(oyente);
      expect(esta.obtener()).toEqual([]);
      dejar();

      otra.actualizar((c) => anadir(c, A));
      eventos.dispatchEvent(new StorageEvent("storage", { key: CLAVE_CESTA }));
      expect(oyente).not.toHaveBeenCalled();

      esta.suscribir(oyente);
      expect(esta.obtener()).toEqual([A]);
    });
  });
});
