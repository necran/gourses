import Link from "../../../components/enlace";

// Se muestra cuando el identificador de la dirección no es una de las
// categorías del catálogo (HU-046). Mismo trato que una ficha inexistente
// (HU-008): un mensaje claro y en castellano, no el 404 de fábrica en inglés.
export default function CategoriaNotFound() {
  return (
    <main style={{ maxWidth: "820px", margin: "0 auto", padding: "3rem 1rem" }}>
      <h1>Categoría no encontrada</h1>
      <p>
        Esa categoría no existe en Gourses. Puede que el enlace esté mal escrito o que sea de
        una versión anterior del sitio.
      </p>
      <p>
        <Link href="/">← Ver todas las categorías</Link>
      </p>
    </main>
  );
}
