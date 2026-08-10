# Checklist manual — Alta en programas de afiliados

No es una historia de usuario: son gestiones externas que solo puede hacer el titular del proyecto (tú), no generan código ni tests, y algunas tardan días en aprobarse. Conviene iniciarlas ya para no bloquear la Fase 1 más adelante.

- [x] **Udemy Affiliate Program** — alta solicitada (2026-07-31), **aprobada y verificada (2026-08-10)**. Credenciales en `.env.local`: `UDEMY_CLIENT_ID` / `UDEMY_CLIENT_SECRET` (Basic Auth). Desbloquea `HU-005` — ver nota de acceso a catálogo abajo.
- [ ] **Impact.com** (red que gestiona la afiliación de Coursera) — crear cuenta de afiliado y solicitar el programa de Coursera dentro de Impact.
- [ ] Confirmar si Impact ofrece feed de producto o solo enlaces de tracking para Coursera — condiciona si Coursera aporta catálogo automático además de comisión (ver `docs/analisis-y-estrategia.md`).
- [ ] Revisar tiempos de aprobación de cada programa y anotarlos aquí una vez conocidos, para planificar cuándo empezar de verdad la ingesta de Fase 1.

## Estado

Udemy: alta aprobada y acceso a catálogo verificado (`HU-005` desbloqueada). Coursera/Impact: token confirmado y en uso desde `HU-006`; queda pendiente solo confirmar el formato del enlace de tracking.

## Nota sobre el acceso al catálogo de Udemy (2026-08-10)

Verificado con llamadas reales usando las credenciales aprobadas. **El catálogo sí es accesible**, pero no por el endpoint que uno esperaría:

| Endpoint | Resultado |
|---|---|
| `GET /api-2.0/courses/` (listado "clásico") | **403** `You do not have permission to perform this action` — sin importar parámetros |
| `GET /api-2.0/courses/{id}/` (detalle) | **200** — incluye `price` y `price_detail` (importe + moneda) |
| `GET /api-2.0/course-categories/` | **200** — 13 categorías |
| `GET /api-2.0/course-categories/{id}/subcategories/` | **200** — 130 subcategorías en total |
| `GET /api-2.0/discovery-units/bestseller/?...` | **200** — listado paginado de cursos por categoría/subcategoría |

El 403 del listado clásico es solo de ese endpoint concreto, no de la API: la vía viable es **descubrimiento por categoría/subcategoría** vía `discovery-units`, que sí pagina de verdad (`pagination.total_item_count`, ~71 cursos por categoría) y devuelve metadatos ricos (valoración, nivel, idioma, instructor, imagen, nº de alumnos) pero **no precio**. El precio se obtiene después con una llamada de detalle por curso.

Parámetros obligatorios de `discovery-units` (si faltan, responde 400 indicando cuál): `source_page` (`category_page` / `subcategory_page`), `context`, y `category_id` / `subcategory_id`. Para la unidad `bestseller` hacen falta además `fl`, `fft`, `sos` y `apply_campaign_filter`, tal como los devuelve la propia API en el campo `url` de cada unidad.

Conclusión: Udemy **cumple** la regla de admisión (catálogo oficial y consultable, sin scraping) y se queda en la ingesta automática.

## Nota sobre el token de afiliación (2026-07-31, **corregida el 2026-08-10**)

Lo único seguro: **no da acceso al catálogo de Coursera**, que es público vía `build.coursera.org` y no necesita autenticación. Por eso no bloqueó `HU-004` ni `HU-006`.

Lo que se dio por confirmado y no lo estaba: se anotó como "token de Impact.com" a partir de una respuesta del titular, sin comprobarlo contra ninguna API. El 2026-08-10, al intentar usarlo de verdad, **devuelve `401` contra `api.impact.com`**, y el titular precisa que lo obtuvo desde la web de Coursera / su programa de afiliados, no desde un panel de Impact.

Estado real, sin adornos: **no sabemos qué es ese token ni si existe una cuenta de Impact.** Dos cosas encajan con lo observado y no se han distinguido todavía:

1. El alta de afiliado de Coursera se hace en `about.coursera.org/affiliates`, cuyo formulario **es de Impact por debajo**: es posible que la cuenta de Impact se creara ahí sin que el titular lo percibiera, con las credenciales en su correo. En ese caso el `401` se explica por la falta del `AccountSID`, no por el token.
2. El token es de otra cosa y la etiqueta lleva días equivocada.

Cómo distinguirlo (acción manual, solo el titular): entrar en `app.impact.com`, usar **"Forgot Password or Username"** con el correo del alta de Coursera. Si Impact reconoce el correo, la cuenta existe (caso 1); si no, hay que darse de alta (caso 2).

Variable correspondiente: `IMPACT_API_TOKEN` (renombrada desde `IMPACT_COURSERA_API_TOKEN`, porque una misma cuenta de Impact cubriría Udemy y Coursera). Vive solo en `.env.local`, nunca en el repo.

**Lección, para no repetirla:** una credencial no se marca como "confirmada" hasta que una llamada real a su API responde algo distinto de `401`. Esta nota ya indujo a error una vez.
