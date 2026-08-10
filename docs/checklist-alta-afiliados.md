# Checklist manual — Alta en programas de afiliados

No es una historia de usuario: son gestiones externas que solo puede hacer el titular del proyecto (tú), no generan código ni tests, y algunas tardan días en aprobarse. Conviene iniciarlas ya para no bloquear la Fase 1 más adelante.

- [x] **Udemy Affiliate Program** — alta solicitada (2026-07-31), **aprobada y verificada (2026-08-10)**. Credenciales en `.env.local`: `UDEMY_CLIENT_ID` / `UDEMY_CLIENT_SECRET` (Basic Auth). Desbloquea `HU-005` — ver nota de acceso a catálogo abajo.
- [x] **Impact.com** — cuenta creada y credenciales verificadas (2026-08-10). **Pendiente**: activar los *scopes* del token y conseguir que aprueben alguna asociación (`Campaigns` está a 0). Ver nota abajo.
- [ ] Confirmar si Impact ofrece feed de producto o solo enlaces de tracking para Coursera — condiciona si Coursera aporta catálogo automático además de comisión (ver `docs/analisis-y-estrategia.md`).
- [ ] Revisar tiempos de aprobación de cada programa y anotarlos aquí una vez conocidos, para planificar cuándo empezar de verdad la ingesta de Fase 1.

## Estado

Udemy: alta aprobada y acceso a catálogo verificado (`HU-005` cerrada). Impact: cuenta y credenciales funcionando, pero sin scopes ni asociaciones aprobadas, así que `HU-009` (enlaces de afiliado) sigue bloqueada y la web todavía no genera comisión.

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

## Nota sobre el acceso a Impact.com (resuelta el 2026-08-10)

Se aclaró definitivamente, con llamadas reales a `api.impact.com`:

- **La cuenta de Impact sí existe** y el token que se recibió el 2026-07-31 **sí era de Impact**. La confusión venía de que el panel de Impact se muestra con la marca de Coursera (es el programa de Coursera *dentro* de Impact), así que parecía "la web de Coursera".
- El `401` inicial se debía a que faltaba el `AccountSID`: Impact usa Basic Auth con **SID como usuario y token como contraseña**. Con ambos, autentica correctamente.

### Lo que sí funciona y lo que no

| Endpoint | Resultado |
|---|---|
| `Campaigns`, `Ads`, `Catalogs`, `Reports` | **200** — credenciales válidas |
| `Programs`, `TrackingLinks`, `MediaPartnerProperties` | **403 Access Denied** — sin permisos |

### Los dos bloqueos reales de `HU-009`

1. **Scopes del token**: los tres endpoints que hacen falta para generar enlaces devuelven `403`. Se activan en la pestaña **Scopes** del token, en el panel de Impact.
2. **No hay ninguna asociación aprobada**: `Campaigns` devuelve `@total: 0` y una lista vacía. Sin un programa aprobado (Coursera o Udemy) no hay a qué generar enlaces, aunque los permisos estuvieran puestos. Es decir, la solicitud de afiliación sigue sin aprobarse o no se llegó a completar desde esta cuenta.

El segundo es el bloqueo de fondo: es una gestión externa que depende de la aprobación de la plataforma, no de configuración nuestra.

**Lección, para no repetirla:** una credencial no se marca como "confirmada" hasta que una llamada real a su API responde algo distinto de `401`. La nota anterior daba por confirmado el origen del token sin haberlo probado, y eso indujo a error dos veces: primero al etiquetarlo, y después al deducir que la cuenta no existía.
