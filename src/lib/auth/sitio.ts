import { TITULAR } from "../legal/titular";

// Dirección base de *esta* instancia, para los enlaces que tienen que volver a
// ella (el enlace de acceso de HU-018).
//
// No vale `TITULAR.url`: eso es la dirección canónica del sitio publicado, la
// que va en el sitemap y en los datos estructurados, y es correcta ahí. Pero un
// enlace de acceso generado en local debe volver a local; con la canónica, el
// correo te lleva a producción y la sesión se crea en el sitio equivocado.
//
// Tampoco se deduce de la cabecera `Host` de la petición: quien llama controla
// esa cabecera, y aquí acabaría dentro de un enlace enviado por correo — es
// justo la forma de convertir el acceso en un redirector a un sitio ajeno.
// Por eso es una variable de entorno explícita, como manda la regla del
// proyecto de no fijar direcciones en el código.
export function urlSitio(): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configurada && configurada.length > 0 ? configurada : TITULAR.url).replace(/\/+$/, "");
}
