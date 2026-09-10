import { describe, expect, it } from "vitest";
import { avisoAcceso } from "./aviso-acceso";

describe("avisoAcceso", () => {
  it("traduce el código que manda el callback", () => {
    expect(avisoAcceso("enlace")).toMatch(/ya no sirve/i);
  });

  it("no dice nada cuando no hay parámetro", () => {
    expect(avisoAcceso(undefined)).toBeUndefined();
  });

  // Lo importante de todo esto: la dirección la escribe quien quiera. Si el
  // parámetro se mostrara tal cual, se podría montar un mensaje falso con la
  // pinta de venir del sitio y mandar el enlace a quien fuera.
  it("nunca deja pasar un texto de la dirección", () => {
    const inventado = "Tu cuenta está bloqueada, llama al 900 123 456";

    expect(avisoAcceso(inventado)).toBeUndefined();
    expect(avisoAcceso("<script>alert(1)</script>")).toBeUndefined();
    expect(avisoAcceso("caducado")).toBeUndefined();
  });

  // Heredar de `Object.prototype` es la forma clásica de colar un valor donde
  // se comprueba la pertenencia con `in` o accediendo a la propiedad.
  it("no se cree las propiedades heredadas", () => {
    expect(avisoAcceso("toString")).toBeUndefined();
    expect(avisoAcceso("constructor")).toBeUndefined();
    expect(avisoAcceso("__proto__")).toBeUndefined();
  });

  // `?error=a&error=enlace` llega como array. No se elige uno de los dos.
  it("no elige cuando el parámetro viene repetido", () => {
    expect(avisoAcceso(["enlace"])).toBeUndefined();
    expect(avisoAcceso(["otro", "enlace"])).toBeUndefined();
  });
});
