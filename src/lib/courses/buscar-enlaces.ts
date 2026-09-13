import type { CourseSearchFilters } from "./search-filters";

// Construye la dirección de otra página conservando la búsqueda (HU-025).
//
// Se arma con los filtros **ya saneados**, no con lo que venía en la dirección:
// así un parámetro basura que alguien haya colado no se reenvía tal cual en los
// enlaces de la página. Aparte de la página de /buscar desde HU-042, que la
// reutiliza para reconstruir la última búsqueda guardada.
export function enlacePagina(filters: CourseSearchFilters, pagina: number): string {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.minRating !== null) params.set("minRating", String(filters.minRating));
  // En horas, como se pide y como se enseña; por dentro son minutos (HU-048).
  if (filters.maxDuration !== null) {
    params.set("maxDuration", String(filters.maxDuration / 60));
  }
  if (filters.language) params.set("language", filters.language);
  if (filters.category) params.set("category", filters.category);
  if (filters.incluirSinDato) params.set("sinDato", "1");
  if (filters.orden) params.set("orden", filters.orden);
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/buscar?${query}` : "/buscar";
}
