import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { BarraCesta } from "../components/barra-cesta";
import { Analitica } from "../components/analitica";
import { idMedicionValido } from "../lib/id-analitica";
import { IMAGEN_COMPARTIR, OPEN_GRAPH_SITIO } from "../lib/seo/seo-sitio";

// Google Analytics (HU-051). El identificador sale del entorno y no del código:
// solo se fija en producción (netlify.toml), así que en local y en los tests no
// se carga nada ni se manda tráfico falso a la propiedad real. Se valida su
// formato porque acaba dentro de un script.
const ID_ANALITICA = idMedicionValido(process.env.NEXT_PUBLIC_GA_ID);

// Tipografía del rediseño (2026-08-24): Sora para titulares, Plus Jakarta Sans
// para el cuerpo. Sustituyen a las Geist por defecto de la plantilla de
// Next.js, que nunca se habían tocado.
const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Un comparador vive del tráfico de búsqueda, así que estos metadatos son
// parte del producto: es lo que se ve en Google y al compartir un enlace.
export const metadata: Metadata = {
  metadataBase: new URL("https://gourses.com"),
  title: {
    default: "Gourses — Compara cursos online de varias plataformas",
    template: "%s | Gourses",
  },
  description:
    "Busca y compara cursos de Udemy y Coursera en un solo sitio: precio, valoración, duración e idioma, uno al lado del otro.",
  openGraph: {
    title: "Gourses — Compara cursos online de varias plataformas",
    description:
      "Busca y compara cursos de Udemy y Coursera en un solo sitio: precio, valoración, duración e idioma, uno al lado del otro.",
    // Imagen, nombre del sitio e idioma, compartidos con las páginas que declaran
    // su propio openGraph (HU-056).
    ...OPEN_GRAPH_SITIO,
  },
  // Tarjeta grande, que es la que enseña la imagen a buen tamaño en X.
  twitter: {
    card: "summary_large_image",
    images: [IMAGEN_COMPARTIR],
  },
};

// Verificación de propiedad del dominio para Impact.com (HU-009). Impact exige
// el atributo `value`, no el `content` habitual, así que no puede declararse
// con la API de metadatos de Next.js ni escribirse como JSX normal: el tipo de
// <meta> no admite `value`. No es un secreto — está pensado para servirse
// públicamente en el HTML de la página.
const IMPACT_SITE_VERIFICATION = {
  name: "impact-site-verification",
  value: "bf503000-b8c1-4934-941d-22d877e85818",
} as unknown as React.MetaHTMLAttributes<HTMLMetaElement>;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sora.variable} ${plusJakartaSans.variable}`}>
      <head>
        <meta {...IMPACT_SITE_VERIFICATION} />
      </head>
      <body>
        <Header />
        {children}
        <Footer />
        <BarraCesta />
        {/* Solo con consentimiento previo: sin él no se carga nada de Google. */}
        {ID_ANALITICA && <Analitica idMedicion={ID_ANALITICA} />}
      </body>
    </html>
  );
}
