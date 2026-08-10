// affiliate_url llega de las APIs externas y se guarda en la base de datos, y
// en la ficha acaba en el href del botón principal. Un href sí es un sink
// peligroso (a diferencia del src de una imagen): un valor "javascript:..."
// ejecutaría código al pulsarlo. Solo se dejan pasar enlaces http(s).
const PROTOCOLOS_PERMITIDOS = new Set(["http:", "https:"]);

export function safeExternalUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return PROTOCOLOS_PERMITIDOS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    // Una URL relativa o malformada tampoco sirve como enlace a la plataforma.
    return null;
  }
}
