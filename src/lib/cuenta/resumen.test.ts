import { describe, expect, it } from "vitest";
import {
  FINALIDAD_Y_CONSERVACION,
  formatearFecha,
  resumenDeCuenta,
  type EntradaResumen,
} from "./resumen";

function entrada(overrides: Partial<EntradaResumen> = {}): EntradaResumen {
  return {
    correo: "alguien@example.com",
    altaEn: "2026-08-01T10:00:00.000Z",
    ultimoAccesoEn: "2026-09-10T08:30:00.000Z",
    numeroDeFavoritos: 3,
    avisosDeBajadaDePrecio: true,
    ...overrides,
  };
}

describe("formatearFecha", () => {
  it("da el día en español, sin hora", () => {
    expect(formatearFecha("2026-08-01T10:00:00.000Z")).toBe("1 de agosto de 2026");
  });

  it("toma el día en UTC, no en la zona del servidor", () => {
    // 23:30 UTC del día 9: en una zona al este seguiría siendo el 10, pero el
    // resumen debe dar siempre el mismo día pase donde pase.
    expect(formatearFecha("2026-09-09T23:30:00.000Z")).toBe("9 de septiembre de 2026");
  });

  it("no revienta con una fecha ausente o ilegible", () => {
    expect(formatearFecha(null)).toBe("No disponible ahora mismo");
    expect(formatearFecha(undefined)).toBe("No disponible ahora mismo");
    expect(formatearFecha("no es una fecha")).toBe("No disponible ahora mismo");
  });
});

describe("resumenDeCuenta", () => {
  it("reúne correo, fechas, recuento y preferencia de avisos", () => {
    const { lineas } = resumenDeCuenta(entrada());
    const porEtiqueta = Object.fromEntries(lineas.map((l) => [l.etiqueta, l.valor]));

    expect(porEtiqueta["Tu correo"]).toBe("alguien@example.com");
    expect(porEtiqueta["Cuenta creada el"]).toBe("1 de agosto de 2026");
    expect(porEtiqueta["Último acceso"]).toBe("10 de septiembre de 2026");
    expect(porEtiqueta["Cursos en favoritos"]).toBe("3");
    expect(porEtiqueta["Avisos de bajada de precio"]).toBe("Activados");
  });

  it("dice «Desactivados» cuando la preferencia está a false", () => {
    const { lineas } = resumenDeCuenta(entrada({ avisosDeBajadaDePrecio: false }));
    expect(lineas.find((l) => l.etiqueta === "Avisos de bajada de precio")?.valor).toBe(
      "Desactivados"
    );
  });

  // Si una parte no se pudo leer, esa línea lo dice y las demás siguen: el
  // resumen es informativo, no una condición para gestionar la cuenta.
  it("marca solo la línea que falta, sin tumbar el resto", () => {
    const { lineas } = resumenDeCuenta(
      entrada({ numeroDeFavoritos: null, avisosDeBajadaDePrecio: null })
    );
    const porEtiqueta = Object.fromEntries(lineas.map((l) => [l.etiqueta, l.valor]));

    expect(porEtiqueta["Cursos en favoritos"]).toBe("No disponible ahora mismo");
    expect(porEtiqueta["Avisos de bajada de precio"]).toBe("No disponible ahora mismo");
    // El correo y la fecha de alta, que sí venían, se mantienen.
    expect(porEtiqueta["Tu correo"]).toBe("alguien@example.com");
    expect(porEtiqueta["Cuenta creada el"]).toBe("1 de agosto de 2026");
  });

  it("0 favoritos se muestra como 0, no como «no disponible»", () => {
    const { lineas } = resumenDeCuenta(entrada({ numeroDeFavoritos: 0 }));
    expect(lineas.find((l) => l.etiqueta === "Cursos en favoritos")?.valor).toBe("0");
  });
});

// La finalidad y el plazo tienen que seguir diciendo lo mismo que `/privacidad`.
// Aquí se fija que no se pierdan en una edición; el e2e comprueba que la otra
// página los repite.
describe("finalidad y conservación", () => {
  it("nombra el plazo y la base jurídica", () => {
    expect(FINALIDAD_Y_CONSERVACION).toMatch(/mientras tengas la cuenta/i);
    expect(FINALIDAD_Y_CONSERVACION).toMatch(/6\.1\.b/);
    expect(FINALIDAD_Y_CONSERVACION).toMatch(/identificarte/i);
  });
});
