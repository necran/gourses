import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "../components/header";
import { Footer } from "../components/footer";

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
    type: "website",
    locale: "es_ES",
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
      </body>
    </html>
  );
}
