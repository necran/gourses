import type { NextConfig } from "next";

// Cabeceras de seguridad (HU-034). Estaban solo en netlify.toml (HU-014/HU-018),
// pero el runtime de Next.js en Netlify no aplica del todo su bloque [[headers]]
// a las páginas que sirve por función: en producción llegaban solo
// X-Content-Type-Options y una versión recortada de HSTS. Declararlas aquí hace
// que las emita el propio Next.js, pase por donde pase la respuesta —y también
// valen en `next dev`, así que un test puede comprobarlas sin desplegar.
const cabecerasDeSeguridad = [
  {
    // Desde HU-018 hay cookies de sesión: una primera visita por http:// deja
    // de ser inofensiva. `includeSubDomains` porque el correo y otros servicios
    // cuelgan del mismo dominio.
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // El sitio no necesita ninguna de estas capacidades del navegador.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabecerasDeSeguridad }];
  },
};

export default nextConfig;
