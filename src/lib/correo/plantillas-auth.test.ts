// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PLANTILLAS_AUTH,
  leerPlantilla,
  renderizar,
  VARIABLES_SUPABASE,
} from "./plantillas-auth";

const URL_DE_PRUEBA = "https://gourses.com/acceder/callback?code=abc123";

function renderizada(id: string): string {
  // `Email`/`NewEmail` solo los usa `cambio-de-correo`; pasarlos siempre no
  // afecta a las otras dos, que no los mencionan.
  return renderizar(leerPlantilla(id), {
    ConfirmationURL: URL_DE_PRUEBA,
    Email: "actual@example.com",
    NewEmail: "nuevo@example.com",
  });
}

// Palabras de la plantilla de fábrica de Supabase. Si alguna sobrevive, es que
// se copió el original en vez de escribir el correo.
const RESTOS_EN_INGLES = [
  "Magic Link",
  "Confirm your signup",
  "Follow this link",
  "Follow the link",
  "sign in",
  "Sign in",
  "Log In",
  "your email",
];

describe("plantillas de correo de Supabase Auth", () => {
  // Las dos, no una: `signInWithOtp` manda «Confirm signup» a quien entra por
  // primera vez y «Magic Link» a quien ya tiene cuenta.
  it("cubre los dos correos que puede mandar el formulario de acceso", () => {
    const claves = PLANTILLAS_AUTH.map((p) => p.claveSupabase);
    expect(claves).toContain("confirmation");
    expect(claves).toContain("magic_link");
  });

  // HU-037: el cambio de correo es otro correo más que Supabase puede mandar,
  // y con el mismo riesgo que los otros dos de quedarse en inglés de fábrica.
  it("cubre el correo de cambio de dirección", () => {
    expect(PLANTILLAS_AUTH.map((p) => p.claveSupabase)).toContain("email_change");
  });

  for (const plantilla of PLANTILLAS_AUTH) {
    describe(plantilla.id, () => {
      it("se renderiza sin dejar ningún hueco sin rellenar", () => {
        const html = renderizada(plantilla.id);

        // Una errata como `{{ .ConfirmationUrl }}` no falla en Supabase: manda
        // el correo con el enlace vacío y nadie puede entrar.
        expect(html).not.toContain("{{");
        expect(html).not.toContain("}}");
      });

      it("lleva el enlace de acceso y no otra dirección inventada", () => {
        const html = renderizada(plantilla.id);

        expect(html).toContain(`href="${URL_DE_PRUEBA}"`);
        // Y también en texto plano, para el cliente de correo que no pinte
        // enlaces o para quien prefiera copiarlo a mano.
        expect(html.split(URL_DE_PRUEBA).length - 1).toBeGreaterThanOrEqual(2);
      });

      // La política de privacidad promete que no hay rastreadores. Un enlace a
      // un dominio de seguimiento en el correo la incumpliría sin que se note.
      it("no apunta a ningún dominio que no sea el del sitio", () => {
        const html = renderizada(plantilla.id).replace(URL_DE_PRUEBA, "");
        const dominios = [...html.matchAll(/href="https?:\/\/([^/"]+)/g)].map((m) => m[1]);

        for (const dominio of dominios) {
          expect(dominio).toBe("gourses.com");
        }
      });

      it("está escrito en español, sin restos de la plantilla de fábrica", () => {
        const html = leerPlantilla(plantilla.id);

        for (const resto of RESTOS_EN_INGLES) {
          expect(html).not.toContain(resto);
        }
        // Y algo de español de verdad, no solo ausencia de inglés.
        expect(html).toMatch(/enlace/i);
      });

      it("tiene asunto propio y en español", () => {
        expect(plantilla.asunto.length).toBeGreaterThan(0);
        expect(plantilla.asunto).toMatch(/Gourses/);
        expect(plantilla.asunto).not.toMatch(/[A-Za-z]+ your |Confirm Your/);
      });

      // Un correo que llega sin haberlo pedido y no explica qué hacer es lo que
      // convierte un aviso legítimo en algo que se marca como spam.
      it("dice qué hacer si no lo has pedido tú", () => {
        expect(renderizada(plantilla.id)).toMatch(/si no has sido tú/i);
      });

      // La política de privacidad promete que no hay rastreadores, y una imagen
      // remota en un correo **es** un rastreador: al abrirlo, el cliente pide el
      // fichero y quien lo sirve se entera de cuándo y desde dónde se ha leído.
      // El correo se dibuja solo con texto y fondos, así que no debe haber
      // ninguna. La regla hermana para los enlaces ya está más arriba.
      it("no carga ninguna imagen remota", () => {
        const html = leerPlantilla(plantilla.id);
        const remotas = [...html.matchAll(/<img\b[^>]*\bsrc=["']?(https?:)?\/\//gi)];

        expect(remotas).toHaveLength(0);
      });

      // El correo se manda a gente hispanohablante y lo pueden leer lectores de
      // pantalla: sin `lang`, el sintetizador lo pronuncia como si fuera inglés.
      it("declara que está en español", () => {
        expect(leerPlantilla(plantilla.id)).toMatch(/<html[^>]*\blang="es"/);
      });
    });
  }
});

describe("renderizar", () => {
  it("sustituye la variable con y sin espacios alrededor", () => {
    expect(renderizar("<a href='{{ .SiteURL }}'>{{.SiteURL}}</a>", { SiteURL: "x" })).toBe(
      "<a href='x'>x</a>"
    );
  });

  it("no se inventa variables que Supabase no rellena", () => {
    expect(() => renderizar("{{ .Inventada }}", {})).toThrow(/no rellena/);
  });

  it("acepta todas las que Supabase sí rellena", () => {
    for (const nombre of VARIABLES_SUPABASE) {
      expect(renderizar(`{{ .${nombre} }}`, { [nombre]: "ok" })).toBe("ok");
    }
  });
});
