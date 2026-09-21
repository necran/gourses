import { describe, expect, it } from "vitest";
import robots, { RASTREADORES_SIN_VALOR, RUTAS_SIN_INTERES } from "./robots";

// HU-071. Quién puede rastrear qué. Se prueba la función, que es la fuente del
// robots.txt que sirve Next.

type Regla = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const reglas = () => robots().rules as Regla[];
const paraTodos = () => reglas().find((r) => r.userAgent === "*")!;
const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

// Como lo interpreta Google: prefijo, con `*` como comodín.
function bloqueada(ruta: string, disallow: string[]): boolean {
  return disallow.some((patron) => {
    const re = new RegExp("^" + patron.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
    return re.test(ruta);
  });
}

describe("robots.txt (HU-071)", () => {
  const disallow = () => lista(paraTodos().disallow);

  it("sigue permitiendo el rastreo y apuntando al sitemap", () => {
    expect(lista(paraTodos().allow)).toContain("/");
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("no rastrea las búsquedas con filtros, que son infinitas y con el mismo contenido", () => {
    for (const ruta of ["/buscar?keyword=python", "/buscar?orden=precio-asc&pagina=2", "/buscar?maxPrice=20"]) {
      expect(bloqueada(ruta, disallow()), ruta).toBe(true);
    }
    // El buscador a secas sí: tiene título y canónica propios (HU-056).
    expect(bloqueada("/buscar", disallow())).toBe(false);
  });

  it("no rastrea los datos internos de navegación (?_rsc=)", () => {
    for (const ruta of ["/?_rsc=abc12", "/curso/0002e82a-afb6-4472-bb3f-3f2c8a1e9b7d?_rsc=1x2y3", "/categoria/negocios?pagina=2&_rsc=k9"]) {
      expect(bloqueada(ruta, disallow()), ruta).toBe(true);
    }
  });

  it("no rastrea las páginas de cuenta y comparación", () => {
    for (const ruta of ["/comparar?ids=a,b", "/favoritos", "/mi-cuenta", "/acceder", "/boletin/baja?t=x", "/cuenta-borrada"]) {
      expect(bloqueada(ruta, disallow()), ruta).toBe(true);
    }
  });

  it("deja rastrear todo lo que es contenido y debe posicionar", () => {
    const contenido = [
      "/",
      "/buscar",
      "/curso/0002e82a-afb6-4472-bb3f-3f2c8a1e9b7d",
      "/categoria",
      "/categoria/negocios",
      "/categoria/negocios?pagina=2",
      "/cursos",
      "/cursos/python",
      "/cursos/python?pagina=2",
      "/novedades",
      "/novedades?pagina=2",
      "/guias",
      "/guias/udemy-o-coursera",
      "/guias/cuanto-cuesta-un-curso",
      "/privacidad",
      "/aviso-legal",
      "/afiliacion",
    ];
    for (const ruta of contenido) expect(bloqueada(ruta, disallow()), ruta).toBe(false);
  });

  it("bloquea por completo a los rastreadores de IA y SEO sin valor", () => {
    const regla = reglas().find((r) => r.userAgent !== "*")!;
    expect(lista(regla.userAgent)).toEqual(RASTREADORES_SIN_VALOR);
    expect(lista(regla.disallow)).toEqual(["/"]);
    for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Bytespider", "AhrefsBot", "SemrushBot"]) {
      expect(RASTREADORES_SIN_VALOR).toContain(bot);
    }
  });

  it("no bloquea a los buscadores ni a los rastreadores de búsqueda con IA, que pueden traer visitas", () => {
    for (const bot of ["Googlebot", "Bingbot", "DuckDuckBot", "Applebot", "OAI-SearchBot", "PerplexityBot", "*"]) {
      expect(RASTREADORES_SIN_VALOR, bot).not.toContain(bot);
    }
  });

  it("la lista de rutas no incluye nada de contenido por error", () => {
    expect(RUTAS_SIN_INTERES).not.toContain("/");
    expect(RUTAS_SIN_INTERES).not.toContain("/curso");
    expect(RUTAS_SIN_INTERES).not.toContain("/categoria");
  });
});
