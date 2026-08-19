import { describe, expect, it } from "vitest";
import { mapConLimite } from "./concurrencia";

describe("HU-023 — concurrencia acotada", () => {
  it("devuelve los resultados en el orden de entrada, no en el de finalización", async () => {
    // El primero tarda más: si se devolviera por orden de llegada, saldría al final.
    const r = await mapConLimite([30, 1, 1], 3, async (ms, i) => {
      await new Promise((res) => setTimeout(res, ms));
      return i;
    });

    expect(r).toEqual([0, 1, 2]);
  });

  it("nunca ejecuta más tareas a la vez que el límite", async () => {
    let enCurso = 0;
    let maximo = 0;

    await mapConLimite(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      enCurso += 1;
      maximo = Math.max(maximo, enCurso);
      await new Promise((res) => setTimeout(res, 5));
      enCurso -= 1;
    });

    expect(maximo).toBe(4);
  });

  it("ejecuta cada elemento exactamente una vez", async () => {
    const vistos: number[] = [];
    await mapConLimite([1, 2, 3, 4, 5], 2, async (n) => {
      vistos.push(n);
    });

    expect(vistos.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("con un límite mayor que la lista no crea obreros de más", async () => {
    const r = await mapConLimite([1, 2], 10, async (n) => n * 2);
    expect(r).toEqual([2, 4]);
  });

  it("una lista vacía no ejecuta nada", async () => {
    let llamadas = 0;
    const r = await mapConLimite([], 4, async () => {
      llamadas += 1;
    });

    expect(r).toEqual([]);
    expect(llamadas).toBe(0);
  });

  it("un límite inválido se rechaza en vez de comportarse de forma rara", async () => {
    await expect(mapConLimite([1], 0, async (n) => n)).rejects.toThrow(/al menos 1/i);
  });
});
