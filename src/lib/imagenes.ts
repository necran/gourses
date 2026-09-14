// Carga de las miniaturas de curso en las listas (HU-050).
//
// Las primeras se piden de inmediato porque suelen verse nada más entrar:
// diferirlas empeoraría justo la carga que se quiere mejorar. El resto se
// difiere hasta que se acercan a la pantalla, que en /buscar son 46 de 50
// imágenes que nadie ve si no baja.
export const MINIATURAS_INMEDIATAS = 4;

export function cargaDeMiniatura(posicion: number): "eager" | "lazy" {
  return posicion < MINIATURAS_INMEDIATAS ? "eager" : "lazy";
}

// Tamaño de las imágenes que publica Udemy (480×270). Van como atributos para
// que el navegador reserve el hueco antes de cargarlas y la página no salte;
// el tamaño en pantalla lo sigue decidiendo el CSS de cada página.
export const DIMENSIONES_MINIATURA = { width: 480, height: 270 } as const;
