// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Enlace from "./enlace";

// HU-071. Cada `<Link>` con prefetch por defecto es una petición al servidor por
// cada enlace que entra en pantalla: una visita llegaba a generar 65. Por eso el
// sitio usa `Enlace`, y este test impide que alguien vuelva a importar
// `next/link` por su cuenta.

const RAIZ = path.join(import.meta.dirname, "..");

function ficheros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(ruta);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [ruta] : [];
  });
}

describe("Enlace (HU-071)", () => {
  it("no hace prefetch por defecto", () => {
    const elemento = Enlace({ href: "/buscar", children: "Buscar" });
    expect(elemento.props.prefetch).toBe(false);
    expect(elemento.props.href).toBe("/buscar");
  });

  it("deja pedir prefetch explícito en un enlace concreto", () => {
    expect(Enlace({ href: "/x", prefetch: true, children: "x" }).props.prefetch).toBe(true);
  });

  it("conserva el resto de propiedades", () => {
    const e = Enlace({ href: "/x", className: "boton", rel: "prev", children: "x" });
    expect(e.props.className).toBe("boton");
    expect(e.props.rel).toBe("prev");
  });

  it("ningún fichero del sitio importa next/link, salvo el propio componente", () => {
    const infractores = ficheros(RAIZ)
      .filter((f) => path.basename(f) !== "enlace.tsx")
      .filter((f) => /from\s+["']next\/link["']/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(RAIZ, f));

    expect(infractores).toEqual([]);
  });
});
