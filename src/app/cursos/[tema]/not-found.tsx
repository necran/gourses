import Link from "../../../components/enlace";

// Se muestra cuando el identificador de la dirección no es uno de los temas de la
// lista cerrada (HU-058). Mismo trato que una categoría inexistente (HU-046): un
// mensaje claro y en castellano, no el 404 de fábrica en inglés.
export default function TemaNotFound() {
  return (
    <main style={{ maxWidth: "820px", margin: "0 auto", padding: "3rem 1rem" }}>
      <h1>Tema no encontrado</h1>
      <p>
        No tenemos una página para ese tema. Puede que el enlace esté mal escrito, o que sea
        un tema con pocos cursos en español para dedicarle una página.
      </p>
      <p>
        <Link href="/buscar">Buscar en todo el catálogo</Link>
      </p>
    </main>
  );
}
