import { describe, expect, it } from "vitest";
import { almacenPareceRoto, mensajeAlmacenRoto } from "./almacen-roto";

// HU-073. Lo que pasó de verdad el 17 de septiembre de 2026: se cambió la
// contraseña de producción sin avisar al secreto de GitHub, y la ingesta de
// Udemy —cada curso en su propio try/catch— siguió "teniendo éxito" cada noche
// durante dos semanas con `guardados: 0`, porque un fallo de la base de datos
// caía en la misma bolsa que un curso mal formado.

describe("almacenPareceRoto", () => {
  it("nada procesado no es un almacén roto: no había nada que guardar", () => {
    expect(almacenPareceRoto({ processed: 0, saved: 0 })).toBe(false);
  });

  it("se procesó y no se guardó nada: el almacén rechaza toda escritura", () => {
    expect(almacenPareceRoto({ processed: 8500, saved: 0 })).toBe(true);
    expect(almacenPareceRoto({ processed: 1, saved: 0 })).toBe(true);
  });

  it("aunque casi todo falle, si se guardó al menos uno, no es un almacén roto", () => {
    // Es justo el caso que hay que seguir tolerando: unos cuantos cursos con
    // datos raros, que ya se registran en `failedCourses` y no deben parar el job.
    expect(almacenPareceRoto({ processed: 8500, saved: 1 })).toBe(false);
  });

  it("todo guardado, evidentemente no está roto", () => {
    expect(almacenPareceRoto({ processed: 50, saved: 50 })).toBe(false);
  });
});

describe("mensajeAlmacenRoto", () => {
  it("dice cuántos se procesaron y apunta primero a la conexión, no a los datos", () => {
    const mensaje = mensajeAlmacenRoto({ processed: 8500, saved: 0 });
    expect(mensaje).toContain("8500 cursos");
    expect(mensaje).toMatch(/cadena de conexión/i);
  });
});
