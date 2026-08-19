# Comparador de cursos

Web que agrega catálogos de cursos online (Udemy, Coursera de momento), permite buscar, comparar, guardar favoritos y avisar de bajadas de precio.

Análisis completo de viabilidad, fuentes de datos y roadmap: @docs/analisis-y-estrategia.md

## Estado actual

Fase 0 — cimientos. Todavía no hay código de aplicación. No asumas que existe Next.js, Supabase configurado, ni ninguna dependencia hasta que aparezca en el repo.

## Entorno

- Todo corre en **local** por ahora. El despliegue a un hosting propio es la Fase 6, deliberada y posterior — no se adelanta sin que el usuario lo pida explícitamente.
- Base de datos: Supabase self-hosted en Docker en el NAS (UGREEN), accesible en la red local.
- Nunca hardcodear URLs, claves o credenciales. Todo va por variables de entorno (`.env.local`, nunca commiteado). Ver `.env.example` para las variables esperadas en cada fase.

## Reglas de admisión de fuentes de datos

Antes de integrar cualquier plataforma de cursos:

> ¿Tiene un endpoint de catálogo oficial y consultable? → entra en la ingesta automática.
> ¿Solo tiene programa de afiliados sin catálogo? → se queda fuera de la ingesta automática; solo se añade como ficha manual en fase posterior.
> Nunca se hace scraping de ninguna plataforma. Si no hay API oficial, esa plataforma no entra.

## Reglas de cierre de una historia de usuario

Cada funcionalidad se define primero en `historias/HU-XXX-nombre.md` (ver `historias/_plantilla.md`). Una historia **no se marca como terminada** hasta que, en este orden:

1. Tests unitarios de su lógica en verde.
2. Tests e2e de sus criterios de aceptación en verde.
3. `/security-review` sin hallazgos críticos ni altos abiertos.

No hay excepciones a este orden ni "hecho con pendientes".

## Convenciones de código (se ampliarán cuando exista stack)

- Next.js (App Router) + TypeScript cuando se inicialice el frontend.
- Supabase como única fuente de verdad para datos y autenticación — no se reimplementa auth a mano.
- Los jobs de ingesta y de alertas son código independiente de las rutas web (nunca la web llama en caliente a una API externa de curso).

## Convenciones de Git

- Commits en español, en imperativo, describiendo el porqué cuando no sea obvio.
- Nunca `git push --force` ni `git commit --amend` sobre commits ya compartidos.
- Una historia de usuario = una rama, un PR (cuando exista remoto).

## Despliegues: agrupar, no publicar por historia

Netlify cobra por créditos y el plan gratuito da **300 al mes**. Un despliegue de
producción cuesta del orden de **10**, así que publicar al cerrar cada historia agota
la cuota en unos pocos días de trabajo intenso — pasó el 18 de agosto de 2026, y dejó
el sitio sin poder publicar hasta el 9 de septiembre.

Lo que consume no es el tráfico (60 MB de ancho de banda en todo un mes, 1–2 créditos
diarios entre funciones y peticiones) sino **la cantidad de publicaciones**.

Por tanto: **se acumulan varias historias cerradas y se despliega una vez**, no una por
historia. Cerrar una historia significa dejarla probada y fusionada, no publicada.
Antes de desplegar, comprobar los créditos que quedan en *Usage & billing*.

Para ver los cambios sin gastar créditos está el entorno local (`npm run dev`), que es
la misma aplicación contra la misma base de datos.

## Reglas modulares

Reglas adicionales por área, cargadas solo cuando se tocan los ficheros correspondientes: ver `.claude/rules/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
