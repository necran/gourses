import { describe, expect, it } from "vitest";
import { conReintentos, esReintentable } from "./reintentos";

// No se duerme de verdad: el test comprueba las esperas, no las sufre.
function dormirFalso() {
  const esperas: number[] = [];
  return { esperas, dormir: async (ms: number) => void esperas.push(ms) };
}

describe("HU-023 — reintentos con espera creciente", () => {
  it("no reintenta si la tarea va bien a la primera", async () => {
    let llamadas = 0;
    const r = await conReintentos(async () => {
      llamadas += 1;
      return "ok";
    });

    expect(r).toBe("ok");
    expect(llamadas).toBe(1);
  });

  it("reintenta un 429 y devuelve el resultado cuando sale bien", async () => {
    let llamadas = 0;
    const { esperas, dormir } = dormirFalso();

    const r = await conReintentos(
      async () => {
        llamadas += 1;
        if (llamadas < 3) throw new Error("Udemy API respondió 429 Too Many Requests");
        return "ok";
      },
      { esperaBaseMs: 500, dormir }
    );

    expect(r).toBe("ok");
    expect(llamadas).toBe(3);
    // Creciente: si se insistiera al mismo ritmo, se agobiaría más a la API.
    // La base se pasa explícita para no depender del valor por defecto, que se
    // ajusta según lo que aguante la API.
    expect(esperas).toEqual([500, 1000]);
  });

  // Insistir en un 404 solo gasta tiempo y peticiones.
  it("no reintenta un error que no va a cambiar", async () => {
    let llamadas = 0;
    const { esperas, dormir } = dormirFalso();

    await expect(
      conReintentos(
        async () => {
          llamadas += 1;
          throw new Error("Udemy API respondió 404 Not Found");
        },
        { dormir }
      )
    ).rejects.toThrow(/404/);

    expect(llamadas).toBe(1);
    expect(esperas).toEqual([]);
  });

  it("se rinde tras agotar los intentos y propaga el último error", async () => {
    let llamadas = 0;
    const { dormir } = dormirFalso();

    await expect(
      conReintentos(
        async () => {
          llamadas += 1;
          throw new Error("Udemy API respondió 503 Service Unavailable");
        },
        { intentos: 3, dormir }
      )
    ).rejects.toThrow(/503/);

    expect(llamadas).toBe(3);
  });

  it("reconoce qué códigos merecen otro intento", () => {
    for (const c of [429, 500, 502, 503, 504]) {
      expect(esReintentable(new Error(`respondió ${c}`))).toBe(true);
    }
    for (const c of [400, 401, 403, 404]) {
      expect(esReintentable(new Error(`respondió ${c}`))).toBe(false);
    }
  });
});
