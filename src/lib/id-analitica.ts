// Identificador de Google Analytics (HU-051). Va en su propio módulo, sin React,
// porque lo leen componentes de servidor (layout y pie) y el almacén de
// consentimiento usa hooks que solo existen en el cliente.

// Formato de un identificador de medición de Google Analytics 4. Aunque venga
// de una variable de entorno, se valida: acaba dentro de un script en línea, y
// un valor con comillas o paréntesis sería código ejecutado en cada página.
export function idMedicionValido(id: string | undefined): string | null {
  return typeof id === "string" && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}
