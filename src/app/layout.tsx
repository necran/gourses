import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "../components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
