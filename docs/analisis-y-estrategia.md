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
| Coursera | Catalog API pública (build.coursera.org, beta, sin auth). **Sin precio ni valoración**: no son campos que exista forma de pedir — la API devuelve 200 e ignora en silencio los que no conoce (verificado 2026-08-24) | Vía Impact | Viable — catálogo + comisión |
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

## Estrategia de tráfico orgánico (2026-10-07)

### El diagnóstico, con datos de Search Console (13 sep – 4 oct)

| Métrica | Valor |
|---|---|
| Clics totales | 5 |
| Impresiones totales | 316 |
| Posición media | 12,7 |
| Enlaces externos | **0** |
| Enlaces internos | 898 |

Tres semanas es poco, pero el reparto de esos números ya dice algo importante:

- **4 de los 5 clics vienen de fichas de curso sueltas**, no de categorías ni temas.
- **Las páginas de categoría concentran dos tercios de las impresiones y cero clics**:
  `/categoria/it-y-software` (121 impresiones), `/categoria/desarrollo-personal` (90). Salen
  en la búsqueda, pero tan abajo que nadie llega a pulsar — «cursos de desarrollo personal» es
  un término por el que compiten Udemy y Coursera mismos, con años de autoridad. Un sitio
  nuevo no va a ganar esa pelea con contenido, por bueno que sea.
- **0 enlaces externos.** Ningún otro sitio enlaza a gourses.com todavía. Es la causa de fondo
  de lo anterior: Google pondera mucho la autoridad de enlaces entrantes, y sin ninguno
  cualquier término con competencia se queda fuera de la primera página por mucho contenido
  que haya.
- Lo que sí funciona: el tema **«Liderazgo»** ya trae impresiones por búsquedas reales
  («cursos de liderazgo», «formación en liderazgo»…) — es un término más concreto, con menos
  competidores pelándoselo de frente.

**Conclusión que manda sobre el resto:** esto no se arregla solo escribiendo más código. Hace
falta contenido más específico (donde si se puede competir) y, sobre todo, que algún sitio
externo empiece a enlazar — las dos cosas a la vez, no una sin la otra.

### Dónde sí se puede competir: lo específico, no lo genérico

Con 0 enlaces entrantes, perseguir términos amplios («cursos online», «cursos de marketing»)
es gastar esfuerzo en una pelea ya perdida. Lo que un comparador puede ganar, incluso sin
autoridad, es la **búsqueda concreta** que ningún agregador genérico contesta mejor:

- Temas muy específicos, no categorías: hoy hay 28 páginas de tema indexables (umbral de 20
  cursos en español). Cuantos más temas por debajo del radar de la competencia («Power BI»,
  «SQL», «edición de vídeo»…) tengan su propia página, más oportunidades de aparecer en una
  búsqueda que nadie más contesta con datos reales.
- Guías con cifras propias (HU-063, HU-069): siguen siendo la pieza más defendible, porque
  nadie más tiene los dos catálogos medidos con los mismos campos. Quedan ideas ya identificadas
  y aparcadas:
  - «¿Es buen momento para comprar?» con el histórico de precios (datos ya existen, HU-021).
  - Guías por duración o por nivel, con el mismo patrón de tabla + texto calculado.
- Los resúmenes con IA en español (HU-053/068) siguen generándose solos cada día: cuantas más
  fichas tengan texto propio en vez de solo la descripción copiada de la plataforma, más
  páginas dejan de parecer contenido duplicado a ojos de Google.

### Lo que no se arregla con código: conseguir los primeros enlaces

Con cero enlaces externos, el orden que más suele funcionar para un sitio nuevo sin
presupuesto de difusión:

1. **Comunidades donde la pregunta ya se hace.** Subreddits de aprendizaje online
   (r/learnprogramming y similares), foros de la categoría de cada tema. Enlazar la guía
   «Udemy o Coursera» o la de precios cuando encaje de verdad en la conversación — nunca
   como spam ni enlazando en masa a la vez.
2. **Directorios y listados del sector** (herramientas de comparación, agregadores de
   «startups» o side-projects, Product Hunt): varios aceptan altas gratuitas y son el tipo de
   enlace más fácil de conseguir para un sitio nuevo.
3. **El propio dominio en sitios donde ya se tiene presencia** (perfil de GitHub de este
   mismo repo, si es público; cualquier perfil profesional del titular).

Esto no lo puede ejecutar nadie por el usuario: son altas y publicaciones que exigen una
cuenta y una voz humana, no algo automatizable desde el código.

### Qué no hacer

- **No competir de frente por categorías amplias.** Con autoridad cero, perder ahí el tiempo
  no mueve nada; ver el diagnóstico de arriba.
- **No un blog genérico** («los mejores cursos de X»): ya se descartó por buenos motivos
  (contenido duplicado, sin autoridad para competir, y es el patrón que Google vigila como
  *scaled content abuse*). Las guías con datos propios son la alternativa que sí funciona.
- **No pedir o comprar enlaces en bloque.** Un perfil de enlaces que crece de golpe y desde
  sitios sin relación con el tema es más señal de penalización que de ayuda.

## Regla de cierre de una historia de usuario

Una historia de usuario no se marca como terminada hasta que, en este orden:

1. Los tests unitarios de su lógica pasan en verde.
2. Los tests e2e de sus criterios de aceptación pasan en verde.
3. La revisión de seguridad (`/security-review`) no deja hallazgos críticos o altos abiertos.

Si alguno falla, la historia sigue abierta — no se negocia el orden ni se marca "hecho con pendientes".
