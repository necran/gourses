"use client";

import { almacenConsentimiento } from "../lib/consentimiento";

// Vuelve a abrir la elección de analítica (HU-051). Retirar el consentimiento
// tiene que ser tan fácil como darlo, así que va en el pie de todas las páginas.
export function ConfigurarCookies({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => almacenConsentimiento().reabrir()}
    >
      Configurar cookies
    </button>
  );
}
