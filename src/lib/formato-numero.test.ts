import { describe, expect, it } from "vitest";
import { conSeparadorDeMiles } from "./formato-numero";

describe("conSeparadorDeMiles", () => {
  it("no toca un número corto", () => {
    expect(conSeparadorDeMiles(42)).toBe("42");
  });

  it("separa los miles", () => {
    expect(conSeparadorDeMiles(8796)).toBe("8.796");
  });

  it("separa varios grupos de miles", () => {
    expect(conSeparadorDeMiles(1234567)).toBe("1.234.567");
  });

  it("trunca decimales en vez de redondearlos", () => {
    expect(conSeparadorDeMiles(1234.9)).toBe("1.234");
  });

  it("funciona con cero", () => {
    expect(conSeparadorDeMiles(0)).toBe("0");
  });
});
