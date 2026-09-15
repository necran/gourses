import { describe, expect, it, vi } from "vitest";
import {
  CLAVE_CONSENTIMIENTO,
  crearAlmacenConsentimiento,
  leerEleccion,
} from "./consentimiento";
import { idMedicionValido } from "./id-analitica";

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

describe("leerEleccion (HU-051) — nunca se da por aceptado lo que no se aceptó", () => {
  it("reconoce las dos elecciones", () => {
    expect(leerEleccion("aceptado")).toBe("aceptado");
    expect(leerEleccion("rechazado")).toBe("rechazado");
  });

  it.each([null, "", "true", "1", "ACEPTADO", " aceptado", "si", '{"aceptado":true}'])(
    "%j es «sin decidir»",
    (bruto) => {
      expect(leerEleccion(bruto)).toBeNull();
    }
  );
});

describe("idMedicionValido — el identificador acaba dentro de un script", () => {
  it("acepta un identificador de Google Analytics 4", () => {
    expect(idMedicionValido("G-DGXS33BH5D")).toBe("G-DGXS33BH5D");
  });

  it.each([
    undefined,
    "",
    "UA-12345-1",
    "g-dgxs33bh5d",
    "G-",
    "G-ABC');alert(1);//",
    "G-ABC</script><script>alert(1)</script>",
    "G-DGXS33BH5D ",
  ])("rechaza %j", (id) => {
    expect(idMedicionValido(id)).toBeNull();
  });
});

describe("crearAlmacenConsentimiento", () => {
  it("sin nada guardado está sin decidir", () => {
    expect(crearAlmacenConsentimiento(almacenamientoFalso, null).obtener()).toBeNull();
  });

  it("guarda la elección y otra instancia (una recarga) la lee", () => {
    const storage = almacenamientoFalso();
    crearAlmacenConsentimiento(() => storage, null).decidir("aceptado");

    expect(storage.getItem(CLAVE_CONSENTIMIENTO)).toBe("aceptado");
    expect(crearAlmacenConsentimiento(() => storage, null).obtener()).toBe("aceptado");
  });

  it("reabrir vuelve a «sin decidir» y lo borra del navegador", () => {
    const storage = almacenamientoFalso();
    const almacen = crearAlmacenConsentimiento(() => storage, null);
    almacen.decidir("aceptado");

    almacen.reabrir();

    expect(almacen.obtener()).toBeNull();
    expect(storage.getItem(CLAVE_CONSENTIMIENTO)).toBeNull();
  });

  it("avisa a quien escucha cuando cambia la elección", () => {
    const almacen = crearAlmacenConsentimiento(almacenamientoFalso, null);
    const oyente = vi.fn();
    almacen.suscribir(oyente);

    almacen.decidir("rechazado");
    almacen.reabrir();

    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it("con el almacenamiento bloqueado arranca sin decidir, nunca aceptado", () => {
    expect(crearAlmacenConsentimiento(bloqueado, null).obtener()).toBeNull();
  });

  it("con el almacenamiento bloqueado, lo decidido vale mientras dure la página", () => {
    const almacen = crearAlmacenConsentimiento(bloqueado, null);

    expect(() => almacen.decidir("aceptado")).not.toThrow();
    expect(almacen.obtener()).toBe("aceptado");
  });

  it("un valor corrupto guardado se trata como sin decidir", () => {
    const storage = almacenamientoFalso();
    storage.setItem(CLAVE_CONSENTIMIENTO, "true");
    expect(crearAlmacenConsentimiento(() => storage, null).obtener()).toBeNull();
  });

  it("la elección cambiada en otra pestaña vale también en esta", () => {
    const storage = almacenamientoFalso();
    const eventos = new EventTarget();
    const esta = crearAlmacenConsentimiento(() => storage, eventos);
    const oyente = vi.fn();
    esta.suscribir(oyente);
    expect(esta.obtener()).toBeNull();

    crearAlmacenConsentimiento(() => storage, null).decidir("rechazado");
    eventos.dispatchEvent(new StorageEvent("storage", { key: CLAVE_CONSENTIMIENTO }));

    expect(oyente).toHaveBeenCalledTimes(1);
    expect(esta.obtener()).toBe("rechazado");
  });
});
