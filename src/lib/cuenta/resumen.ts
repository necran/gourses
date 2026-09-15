// Resumen en lenguaje llano de lo que se guarda sobre una persona con cuenta
// (HU-036, RGPD art. 15 — derecho de acceso).
//
// Todo lo de aquí es cálculo puro: recibe lo que ya se leyó de la sesión y de
// la base, y decide cómo se enseña. Ni consulta ni sabe de sesiones, igual que
// `exportacion.ts`, para probarlo a fondo sin base de datos.

const NO_DISPONIBLE = "No disponible ahora mismo";

// La misma finalidad y el mismo plazo que declara `/privacidad` («Para qué y
// con qué base jurídica» y «Cuánto tiempo»). Se centraliza aquí para que un
// cambio en una parte no deje a la otra mintiendo; un test comprueba que las
// dos páginas siguen diciendo lo mismo.
export const FINALIDAD_Y_CONSERVACION =
  "Todo esto se guarda mientras tengas la cuenta, y solo para identificarte y " +
  "asociarte lo que guardas aquí. La base jurídica es la ejecución del servicio " +
  "que pides al crear la cuenta (artículo 6.1.b del RGPD). Si te apuntas al boletín " +
  "semanal, tu correo se usa también para enviártelo, con tu consentimiento " +
  "(artículo 6.1.a), hasta que te des de baja.";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Fecha en formato humano y en español, sin hora.
//
// Se compone a mano en vez de con `Intl.DateTimeFormat` para no depender de los
// datos de ICU del runtime y para que el resultado sea el mismo aquí y en un
// test. Se toma el día en UTC: para un «creada el» o «último acceso» basta el
// día, y así el valor no baila según la zona horaria del servidor.
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return NO_DISPONIBLE;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return NO_DISPONIBLE;
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

export interface EntradaResumen {
  correo: string | null | undefined;
  /** Fecha de alta de la cuenta, en ISO (la genera el sistema de auth). */
  altaEn: string | null | undefined;
  /** Último acceso, en ISO. */
  ultimoAccesoEn: string | null | undefined;
  /** Cuántos favoritos, o `null` si no se pudo leer. */
  numeroDeFavoritos: number | null;
  /** Preferencia de avisos, o `null` si no se pudo leer. */
  avisosDeBajadaDePrecio: boolean | null;
  /** Si está apuntada al boletín (HU-066), o `null` si no se pudo leer. */
  boletinSemanal: boolean | null;
}

export interface LineaResumen {
  etiqueta: string;
  /** Ya formateado para mostrar; `NO_DISPONIBLE` si el dato no pudo leerse. */
  valor: string;
}

export interface ResumenDeCuenta {
  lineas: LineaResumen[];
  finalidadYConservacion: string;
}

export function resumenDeCuenta(entrada: EntradaResumen): ResumenDeCuenta {
  return {
    lineas: [
      { etiqueta: "Tu correo", valor: entrada.correo || NO_DISPONIBLE },
      { etiqueta: "Cuenta creada el", valor: formatearFecha(entrada.altaEn) },
      { etiqueta: "Último acceso", valor: formatearFecha(entrada.ultimoAccesoEn) },
      {
        etiqueta: "Cursos en favoritos",
        valor:
          entrada.numeroDeFavoritos === null
            ? NO_DISPONIBLE
            : String(entrada.numeroDeFavoritos),
      },
      {
        etiqueta: "Avisos de bajada de precio",
        valor:
          entrada.avisosDeBajadaDePrecio === null
            ? NO_DISPONIBLE
            : entrada.avisosDeBajadaDePrecio
              ? "Activados"
              : "Desactivados",
      },
      {
        etiqueta: "Boletín semanal",
        valor:
          entrada.boletinSemanal === null
            ? NO_DISPONIBLE
            : entrada.boletinSemanal
              ? "Apuntado"
              : "No apuntado",
      },
    ],
    finalidadYConservacion: FINALIDAD_Y_CONSERVACION,
  };
}
