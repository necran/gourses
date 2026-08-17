// Decide si una bajada de precio merece un aviso (HU-021).
//
// Todo lo de aquí es cálculo puro: sin base de datos y sin red. Es la parte que
// más fácil se rompe sin darse cuenta —un signo cambiado y se avisa de subidas—
// y la que más barato sale probar a fondo.

export interface CandidatoAviso {
  precioActual: number | null;
  divisaActual: string | null;
  // Último precio conocido antes del actual, del histórico.
  precioAnterior: number | null;
  divisaAnterior: string | null;
  // Precio al que se avisó por última vez, si se avisó alguna vez.
  precioYaAvisado: number | null;
  divisaYaAvisada: string | null;
}

export type MotivoNoAvisar =
  | "sin-precio"
  | "sin-referencia"
  | "divisas-distintas"
  | "no-ha-bajado"
  | "bajada-insignificante"
  | "ya-avisado";

export type Decision =
  | { avisar: true; precioAnterior: number; precioActual: number; divisa: string }
  | { avisar: false; motivo: MotivoNoAvisar };

// Por debajo de esto la "bajada" es ruido: redondeos, vaivenes de cambio de
// divisa o promociones de un céntimo. Avisar de eso enseñaría a la gente a
// ignorar nuestros correos, que es peor que no mandarlos.
export const BAJADA_MINIMA_RELATIVA = 0.05; // 5 %

export function decidirAviso(c: CandidatoAviso): Decision {
  if (c.precioActual === null) return { avisar: false, motivo: "sin-precio" };
  if (c.precioAnterior === null) return { avisar: false, motivo: "sin-referencia" };

  // Comparar 20 USD con 19 EUR y cantar una bajada sería inventársela. Ante la
  // duda —divisa desconocida en cualquiera de los dos lados— no se avisa.
  if (
    c.divisaActual === null ||
    c.divisaAnterior === null ||
    c.divisaActual !== c.divisaAnterior
  ) {
    return { avisar: false, motivo: "divisas-distintas" };
  }

  if (c.precioActual >= c.precioAnterior) return { avisar: false, motivo: "no-ha-bajado" };

  // Un precio anterior de cero no permite hablar de porcentajes, y tampoco hay
  // bajada posible por debajo de él.
  if (c.precioAnterior <= 0) return { avisar: false, motivo: "no-ha-bajado" };

  const caida = (c.precioAnterior - c.precioActual) / c.precioAnterior;
  if (caida < BAJADA_MINIMA_RELATIVA) {
    return { avisar: false, motivo: "bajada-insignificante" };
  }

  // Ya se avisó antes: solo vuelve a ser noticia si ahora está aún más barato.
  // Sin esto, el job diario repetiría el mismo correo eternamente.
  if (c.precioYaAvisado !== null && c.divisaYaAvisada === c.divisaActual) {
    if (c.precioActual >= c.precioYaAvisado) {
      return { avisar: false, motivo: "ya-avisado" };
    }
  }

  return {
    avisar: true,
    precioAnterior: c.precioAnterior,
    precioActual: c.precioActual,
    divisa: c.divisaActual,
  };
}
