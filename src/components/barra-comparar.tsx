import { MAX_COMPARADOS } from "../lib/courses/compare";
import styles from "./barra-comparar.module.css";

// Cabecera del formulario "Comparar seleccionados" (HU-017), reutilizada
// donde haya un listado de cursos con casillas: /buscar y, desde HU-031,
// también la home. Es solo el botón y la ayuda — el <form method="get"
// action="/comparar"> y las <li> con casillas los pone cada página, porque su
// marcado (tarjeta de búsqueda, tarjeta destacada) es distinto en cada una.
export function BarraComparar() {
  return (
    <div className={styles.barraComparar}>
      <button type="submit" className={styles.botonComparar}>
        Comparar seleccionados
      </button>
      <span className={styles.ayudaComparar}>Marca de 2 a {MAX_COMPARADOS} cursos</span>
    </div>
  );
}

interface CasillaCompararProps {
  courseId: string;
  title: string;
  defaultChecked?: boolean;
}

// Misma casilla en las dos páginas: mismo `name="ids"` (lo que recoge
// parseCompareIds) y mismo estilo. `defaultChecked` la usa /buscar cuando se
// llega desde la ficha de un curso con `?preseleccionado=` (HU-031).
export function CasillaComparar({ courseId, title, defaultChecked }: CasillaCompararProps) {
  return (
    <input
      type="checkbox"
      name="ids"
      value={courseId}
      className={styles.casilla}
      aria-label={`Seleccionar ${title} para comparar`}
      defaultChecked={defaultChecked}
    />
  );
}
