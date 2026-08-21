import type { FavoriteCourse } from "../favorites/favorites";

// Composición del fichero de datos personales (HU-024, RGPD art. 20).
//
// Todo lo de aquí es cálculo puro: recibe lo que ya se leyó de la base y decide
// qué forma tiene el fichero. Ni consulta ni sabe de sesiones, para que se pueda
// probar a fondo sin base de datos y para que la ruta se quede en lo suyo —
// autenticar y responder.

// Versión del formato. Va dentro del propio fichero porque quien se lo lleve a
// otro sitio necesita saber contra qué forma lo está leyendo, y esa forma puede
// cambiar cuando cambien los datos que guardamos.
export const VERSION_FORMATO = 1;

export interface EntradaExportacion {
  correo: string | null;
  /** Fecha de alta de la cuenta, en ISO. */
  altaEn: string | null;
  avisosDeBajadaDePrecio: boolean;
  favoritos: FavoriteCourse[];
}

export interface CursoExportado {
  titulo: string;
  plataforma: string;
  enlace: string | null;
  precio: { importe: number; divisa: string | null } | null;
  categoria: string | null;
  idioma: string | null;
  nivel: string | null;
  instructor: string | null;
  valoracion: number | null;
  duracionMinutos: { min: number; max: number } | null;
}

export interface DatosExportados {
  formato: number;
  generadoEn: string;
  cuenta: {
    correo: string | null;
    altaEn: string | null;
  };
  preferencias: {
    avisosDeBajadaDePrecio: boolean;
  };
  favoritos: CursoExportado[];
}

// Se exporta el curso en el vocabulario común (HU-004/HU-010), no en el crudo de
// la plataforma: es lo que esta persona vio y guardó.
//
// Las claves van en español, como el resto del producto. Un fichero de datos
// personales lo abre una persona, no solo una máquina, y «favoritos» se entiende
// sin documentación.
function exportarCurso(curso: FavoriteCourse): CursoExportado {
  return {
    titulo: curso.title,
    plataforma: curso.source,
    enlace: curso.affiliateUrl,
    // El precio se agrupa en un objeto en vez de dos campos sueltos porque un
    // importe sin divisa no significa nada. O están los dos o no hay precio.
    precio: curso.priceAmount === null ? null : {
      importe: curso.priceAmount,
      divisa: curso.priceCurrency,
    },
    categoria: curso.category,
    idioma: curso.language,
    nivel: curso.level,
    instructor: curso.instructor,
    valoracion: curso.rating,
    duracionMinutos: curso.duration
      ? { min: curso.duration.minMinutes, max: curso.duration.maxMinutes }
      : null,
  };
}

export function componerExportacion(
  entrada: EntradaExportacion,
  ahora: Date = new Date()
): DatosExportados {
  return {
    formato: VERSION_FORMATO,
    generadoEn: ahora.toISOString(),
    cuenta: {
      correo: entrada.correo,
      altaEn: entrada.altaEn,
    },
    preferencias: {
      avisosDeBajadaDePrecio: entrada.avisosDeBajadaDePrecio,
    },
    favoritos: entrada.favoritos.map(exportarCurso),
  };
}

// Nombre del fichero que se descarga.
//
// **Sin el correo dentro**, a propósito: el nombre queda escrito en la carpeta
// de descargas y en el historial del navegador, que es un sitio bastante peor
// para dejar una dirección que el interior del fichero. Con la fecha basta para
// distinguir dos descargas.
export function nombreFicheroExportacion(ahora: Date = new Date()): string {
  const fecha = ahora.toISOString().slice(0, 10);
  return `gourses-mis-datos-${fecha}.json`;
}
