# Análisis y estrategia — Comparador de cursos

Resumen de las decisiones tomadas antes de escribir código. Ver el documento completo con tablas y diseño en el artefacto publicado (fuera del repo); esta versión es la referencia que carga Claude Code.

## Qué es el producto

Web que agrega catálogos de plataformas de cursos online, permite buscar, comparar cursos entre sí, crear cuenta, guardar favoritos y recibir alertas cuando baja el precio de un curso guardado.

## Fuentes de datos (regla de admisión)

Antes de conectar cualquier plataforma nueva:

> ¿Tiene un endpoint de catálogo oficial y consultable? → entra en la ingesta automática.
> ¿Solo tiene programa de afiliados sin catálogo? → entra como partner manual en una fase posterior. Nunca se hace scraping de su web.

Estado actual:

| Plataforma | Catálogo | Afiliación | Estado |
|---|---|---|---|
| Udemy | Affiliate API propia — catálogo vía `discovery-units` por categoría/subcategoría + detalle por curso para el precio (el listado `/api-2.0/courses/` da 403; ver `docs/checklist-alta-afiliados.md`) | Programa propio integrado | Viable — catálogo + comisión (verificado 2026-08-10) |
| Coursera | Catalog API pública (build.coursera.org, beta, sin auth) | Vía Impact | Viable — catálogo + comisión |
| YouTube | YouTube Data API v3 | No aplica | Viable — solo catálogo |
| Skillshare / Domestika / DataCamp / Codecademy | Sin API de catálogo pública | Vía Impact/redes, 15–45% comisión | Solo comisión — fase posterior, ficha manual |
| edX / Platzi / Udacity / Pluralsight | Sin API de catálogo confirmada | A validar caso a caso | Pendiente |

## Entorno: local primero, hosting después

Todo el desarrollo corre en local hasta que se decida explícitamente pasar a producción (Fase 6). Por eso:

- La configuración (URLs de base de datos, claves de API) se lee siempre de variables de entorno, nunca hardcodeada — así pasar a producción es cambiar variables, no reescribir código.
- Base de datos: Supabase self-hosted en Docker en el NAS (UGREEN) mientras se desarrolla.
- El NAS **no** se expone a internet como servidor público. Backups, staging y ejecución de tests también viven ahí.

## Stack

- Frontend + API routes: Next.js (React)
- Base de datos + Auth: Supabase (Postgres, self-hosted en NAS ahora / cloud en Fase 6)
- Ingesta: jobs programados (cron) que llaman a las APIs de catálogo y escriben en Supabase — la web nunca llama a la API externa en caliente
- Alertas de precio: histórico diario de precios + comparación + email (Resend)
- Testing: Vitest (unitario/integración) + Playwright vía MCP (e2e y agentes de QA)

## Roadmap por fases

0. **Cimientos** — repo, CLAUDE.md, entorno local+NAS, pipeline de test vacío.
1. **Catálogo y búsqueda** — ingesta Udemy + Coursera, buscador, ficha de curso.
2. **Comparador** — selección múltiple, vista comparativa.
3. **Cuentas y favoritos** — Supabase Auth, favoritos persistentes.
4. **Alertas de precio** — histórico de precios, job de detección, email.
5. **Ampliar fuentes** — nuevas plataformas por la misma regla de admisión.
6. **Puesta en producción** — hosting, dominio, migración de NAS a cloud, revisión de seguridad final.

## Decisiones de Fase 6 (2026-08-10)

| Pieza | Elección | Motivo |
|---|---|---|
| Web | **Netlify**, plan gratuito | Permite proyectos comerciales, y su soporte de Next.js App Router es oficial. Vercel queda descartado: su plan Hobby prohíbe el uso comercial y menciona el *affiliate linking* como ejemplo explícito, lo que además pondría en riesgo la otra cuenta del titular. Cloudflare depende del adaptador OpenNext, que va por detrás de las versiones de Next.js. |
| Base de datos | **Supabase Cloud**, plan gratuito | Mismo Supabase que en desarrollo, así que migraciones y RLS se aplican tal cual, y sirve para el Auth de la Fase 3. El NAS se queda como entorno de desarrollo y test: por regla del proyecto no se expone a internet. |
| Ingesta | **GitHub Actions** programado | El job de Udemy hace más de 300 peticiones y tarda minutos; las funciones serverless cortan a los 10–30 s y lo matarían a medias. Actions permite hasta 6 h y el repositorio ya está ahí. |
| Dominio | **gourses.com** (IONOS), DNS apuntando a Netlify | Ya adquirido. Un dominio propio también ayuda a que aprueben la afiliación (ver `HU-009`). |

El alojamiento web de IONOS (plan Plus) se evaluó y **no sirve para la app**: soporta PHP, Perl y Python, pero no Node.js, que es lo que necesita el renderizado en servidor. Se aprovecha solo como registrador del dominio.

## Regla de cierre de una historia de usuario

Una historia de usuario no se marca como terminada hasta que, en este orden:

1. Los tests unitarios de su lógica pasan en verde.
2. Los tests e2e de sus criterios de aceptación pasan en verde.
3. La revisión de seguridad (`/security-review`) no deja hallazgos críticos o altos abiertos.

Si alguno falla, la historia sigue abierta — no se negocia el orden ni se marca "hecho con pendientes".
