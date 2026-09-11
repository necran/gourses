import { useSyncExternalStore } from "react";
import {
  CESTA_VACIA,
  CLAVE_CESTA,
  describirCambio,
  leerCesta,
  serializarCesta,
  type Cesta,
} from "./cesta-comparar";

// Dónde vive la cesta de comparación (HU-040): `localStorage`, para que
// sobreviva a «atrás», a recargar y a abrir otra pestaña. Solo se usa desde
// componentes de cliente; en el servidor la cesta siempre está vacía.

export interface AlmacenCesta {
  obtener(): Cesta;
  /** Último cambio hecho en esta pestaña, en palabras, para lectores de pantalla. */
  obtenerAnuncio(): string;
  actualizar(cambio: (cesta: Cesta) => Cesta): Cesta;
  suscribir(oyente: () => void): () => void;
}

// Se construye a partir de funciones y no leyendo `window` directamente para
// poder probarlo con un almacenamiento falso, que falle cuando interese.
export function crearAlmacenCesta(
  obtenerStorage: () => Storage,
  eventos: EventTarget | null
): AlmacenCesta {
  let actual: Cesta | null = null;
  // Si el navegador no deja guardar nada (modo privado estricto, almacenamiento
  // bloqueado), la cesta sigue funcionando en memoria hasta recargar: igual que
  // antes de esta historia, nunca peor.
  let enMemoria = CESTA_VACIA;
  let anuncio = "";
  const oyentes = new Set<() => void>();

  function leer(): Cesta {
    try {
      return leerCesta(obtenerStorage().getItem(CLAVE_CESTA));
    } catch {
      return enMemoria;
    }
  }

  function obtener(): Cesta {
    actual ??= leer();
    return actual;
  }

  function avisar() {
    for (const oyente of oyentes) oyente();
  }

  // Otra pestaña ha cambiado la cesta. `key` nulo es un `clear()` completo.
  function alCambiarEnOtraPestana(evento: Event) {
    const { key } = evento as StorageEvent;
    if (key !== null && key !== CLAVE_CESTA) return;
    actual = null;
    avisar();
  }

  return {
    obtener,

    obtenerAnuncio: () => anuncio,

    actualizar(cambio) {
      const antes = obtener();
      const despues = cambio(antes);
      if (despues === antes) return antes;

      actual = despues;
      enMemoria = despues;
      anuncio = describirCambio(antes, despues);
      try {
        obtenerStorage().setItem(CLAVE_CESTA, serializarCesta(despues));
      } catch {
        // Sin almacenamiento o sin espacio: se queda en memoria (ver arriba).
      }
      avisar();
      return despues;
    },

    suscribir(oyente) {
      if (oyentes.size === 0) {
        // Sin nadie escuchando no se atienden los avisos de otras pestañas, así
        // que lo leído antes puede estar viejo: se vuelve a leer.
        actual = null;
        eventos?.addEventListener("storage", alCambiarEnOtraPestana);
      }
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
        if (oyentes.size === 0) eventos?.removeEventListener("storage", alCambiarEnOtraPestana);
      };
    },
  };
}

let instancia: AlmacenCesta | null = null;

export function almacenCesta(): AlmacenCesta {
  instancia ??= crearAlmacenCesta(() => window.localStorage, window);
  return instancia;
}

const suscribir = (oyente: () => void) => almacenCesta().suscribir(oyente);
const obtener = () => almacenCesta().obtener();
const obtenerAnuncio = () => almacenCesta().obtenerAnuncio();
const cestaEnServidor = () => CESTA_VACIA;
const anuncioEnServidor = () => "";

export function useCesta(): Cesta {
  return useSyncExternalStore(suscribir, obtener, cestaEnServidor);
}

export function useAnuncioCesta(): string {
  return useSyncExternalStore(suscribir, obtenerAnuncio, anuncioEnServidor);
}
