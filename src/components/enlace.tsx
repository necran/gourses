import Link from "next/link";
import type { ComponentProps } from "react";

// Enlace del sitio: `next/link` sin prefetch por defecto (HU-071).
//
// `next/link` prefetcha cada enlace que entra en pantalla, y solo en producción.
// Como el layout lee las cookies de sesión, ninguna página es estática, así que
// **cada prefetch es una petición al servidor que ejecuta una función**. Medido
// sobre la build de producción, una sola visita generaba:
//
//   portada 44 · listado del buscador 58 · categoría 65 · tema 58 · ficha 13
//
// peticiones, el 97-98 % de ellas `?_rsc=`. En Netlify eso son créditos: el sitio
// se pausó el 21 de septiembre de 2026 con 190.000 peticiones en un periodo.
//
// Por eso **ningún fichero importa `next/link` directamente**: usa este
// componente. Un test (`enlace.test.ts`) lo vigila. Quien de verdad quiera
// prefetch en un enlace concreto puede pasar `prefetch` explícito.
export default function Enlace({ prefetch = false, ...props }: ComponentProps<typeof Link>) {
  return <Link prefetch={prefetch} {...props} />;
}
