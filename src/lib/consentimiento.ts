import { useSyncExternalStore } from "react";

// Elección de la persona sobre la analítica (HU-051). Se guarda en el
// navegador y no en una cookie: así ninguna página tiene que leer nada nuevo en
// el servidor. Guardar la propia elección es técnico y no necesita
// consentimiento.

export type EleccionAnalitica = "aceptado" | "rechazado";

export const CLAVE_CONSENTIMIENTO = "gourses:consentimiento-analitica";

// Lo guardado es entrada externa. Solo valen los dos valores exactos; cualquier
// otra cosa es «sin decidir». Nunca se da por aceptado algo que no se aceptó.
export function leerEleccion(bruto: string | null): EleccionAnalitica | null {
  return bruto === "aceptado" || bruto === "rechazado" ? bruto : null;
}

export interface AlmacenConsentimiento {
  obtener(): EleccionAnalitica | null;
  decidir(eleccion: EleccionAnalitica): void;
  /** Vuelve a «sin decidir», para que se pueda cambiar de opinión. */
  reabrir(): void;
  suscribir(oyente: () => void): () => void;
}

export function crearAlmacenConsentimiento(
  obtenerStorage: () => Storage,
  eventos: EventTarget | null
): AlmacenConsentimiento {
  let leido = false;
  let actual: EleccionAnalitica | null = null;
  // Si el navegador no deja guardar, lo decidido vale mientras dure la página.
  // Un fallo al leer, en cambio, es «sin decidir»: nunca «aceptado».
  let enMemoria: EleccionAnalitica | null = null;
  const oyentes = new Set<() => void>();

  function leer(): EleccionAnalitica | null {
    try {
      return leerEleccion(obtenerStorage().getItem(CLAVE_CONSENTIMIENTO));
    } catch {
      return enMemoria;
    }
  }

  function obtener(): EleccionAnalitica | null {
    if (!leido) {
      actual = leer();
      leido = true;
    }
    return actual;
  }

  function avisar() {
    for (const oyente of oyentes) oyente();
  }

  function fijar(eleccion: EleccionAnalitica | null) {
    actual = eleccion;
    enMemoria = eleccion;
    leido = true;
    try {
      if (eleccion === null) obtenerStorage().removeItem(CLAVE_CONSENTIMIENTO);
      else obtenerStorage().setItem(CLAVE_CONSENTIMIENTO, eleccion);
    } catch {
      // Sin almacenamiento: queda en memoria (ver arriba).
    }
    avisar();
  }

  // La elección cambiada en otra pestaña vale también en esta.
  function alCambiarEnOtraPestana(evento: Event) {
    const { key } = evento as StorageEvent;
    if (key !== null && key !== CLAVE_CONSENTIMIENTO) return;
    leido = false;
    avisar();
  }

  return {
    obtener,
    decidir: (eleccion) => fijar(eleccion),
    reabrir: () => fijar(null),
    suscribir(oyente) {
      if (oyentes.size === 0) {
        leido = false;
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

let instancia: AlmacenConsentimiento | null = null;

export function almacenConsentimiento(): AlmacenConsentimiento {
  instancia ??= crearAlmacenConsentimiento(() => window.localStorage, window);
  return instancia;
}

const suscribir = (oyente: () => void) => almacenConsentimiento().suscribir(oyente);
const obtener = () => almacenConsentimiento().obtener();
// En el servidor no se sabe: se pinta como «sin decidir» y el componente espera
// a hidratar antes de enseñar nada.
const enServidor = () => null;

export function useEleccionAnalitica(): EleccionAnalitica | null {
  return useSyncExternalStore(suscribir, obtener, enServidor);
}
