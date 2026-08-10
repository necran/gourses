import Link from "next/link";

// Se muestra cuando el id de la URL no es válido o no corresponde a ningún
// curso (HU-008): mensaje claro, nunca un error sin manejar.
export default function CourseNotFound() {
  return (
    <main style={{ maxWidth: "820px", margin: "0 auto", padding: "3rem 1rem" }}>
      <h1>Curso no encontrado</h1>
      <p>
        El curso que buscas no existe o ya no está en nuestro catálogo. Puede que se haya
        retirado de la plataforma de origen.
      </p>
      <p>
        <Link href="/buscar">← Volver a la búsqueda</Link>
      </p>
    </main>
  );
}
