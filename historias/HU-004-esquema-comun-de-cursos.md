# HU-004 — Esquema común de datos de cursos

## Contexto

Fase 1 (catálogo y búsqueda). Antes de poder ingerir datos de Udemy o Coursera hace falta un modelo de datos único donde encajen ambas fuentes, para que el buscador y el comparador nunca tengan que saber de dónde viene cada curso. Ver la regla de normalización en `.claude/rules/ingesta-fuentes.md`.

## Como desarrollador quiero un esquema de base de datos común para cursos de distintas fuentes para que el resto de la aplicación trabaje siempre contra el mismo modelo

## Criterios de aceptación

- **Given** el esquema definido **When** reviso las tablas **Then** existe una tabla `courses` con al menos: `id`, `source` (`udemy` | `coursera`), `source_id`, `title`, `description`, `price_amount`, `price_currency`, `rating`, `level`, `language`, `instructor`, `affiliate_url`, `image_url`, `updated_at`.
- **Given** el esquema **When** reviso las restricciones **Then** la combinación `(source, source_id)` es única — evita duplicar el mismo curso de la misma fuente.
- **Given** una migración aplicada **When** la vuelvo a aplicar sobre una base ya migrada **Then** no falla ni duplica estructuras (migraciones idempotentes).
- **Given** el esquema **When** reviso el histórico de precios **Then** existe una tabla `course_price_history` (`course_id`, `price_amount`, `price_currency`, `captured_at`) — se usa desde ya aunque las alertas de precio sean Fase 4, para no perder histórico desde el primer día de ingesta.

## Fuera de alcance

Tablas de usuarios, favoritos o alertas (Fase 3 y 4). Lógica de comparación entre cursos (Fase 2).

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Integración: test que aplica la migración contra Supabase local/NAS y comprueba que las tablas y la restricción de unicidad existen
- [ ] Integración: test que intenta insertar un `(source, source_id)` duplicado y comprueba que falla como se espera
- [ ] Unitarios: no aplica (sin lógica de aplicación en esta historia, solo esquema)
- [ ] `/security-review`: revisar políticas de RLS — de momento lectura pública, escritura solo desde el rol de servicio (los jobs de ingesta), nunca desde el cliente

## Estado

Bloqueada — depende de HU-003 (Supabase corriendo en el NAS)
