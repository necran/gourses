# Checklist manual — Alta en programas de afiliados

No es una historia de usuario: son gestiones externas que solo puede hacer el titular del proyecto (tú), no generan código ni tests, y algunas tardan días en aprobarse. Conviene iniciarlas ya para no bloquear la Fase 1 más adelante.

- [x] **Udemy Affiliate Program** — alta solicitada (2026-07-31), **aprobada y verificada (2026-08-10)**. Credenciales en `.env.local`: `UDEMY_CLIENT_ID` / `UDEMY_CLIENT_SECRET` (Basic Auth). Desbloquea `HU-005` — ver nota de acceso a catálogo abajo.
- [x] **Impact.com** — cuenta creada, credenciales y permisos verificados (2026-08-10). **Pendiente y prematuro hasta la Fase 6**: dar de alta la web como *media property* y solicitar los programas. Ver nota abajo.
- [ ] Confirmar si Impact ofrece feed de producto o solo enlaces de tracking para Coursera — condiciona si Coursera aporta catálogo automático además de comisión (ver `docs/analisis-y-estrategia.md`).
- [ ] Revisar tiempos de aprobación de cada programa y anotarlos aquí una vez conocidos, para planificar cuándo empezar de verdad la ingesta de Fase 1.

## Estado

Udemy: alta aprobada y acceso a catálogo verificado (`HU-005` cerrada). Impact: cuenta, credenciales y permisos correctos, pero sin propiedad dada de alta ni asociaciones aprobadas. `HU-009` (enlaces de afiliado) queda aparcada hasta la Fase 6: hasta que la web no esté publicada, no tiene sentido solicitar la afiliación.

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

## Nota sobre el acceso a Impact.com (2026-08-10, diagnóstico definitivo)

Aclarado con llamadas reales a `api.impact.com`:

- **La cuenta existe y el token del 2026-07-31 sí era de Impact.** La confusión venía de que el panel se muestra con la marca de Coursera (es su programa *dentro* de Impact), así que parecía "la web de Coursera". El `401` inicial era solo por faltar el `AccountSID`: Impact usa Basic Auth con **SID como usuario y token como contraseña**.
- **Los permisos del token están bien.** Campaigns, Media Properties, Tracking Links, Ads, Reports y Promotions están todos activados. Unos primeros `403` hicieron pensar lo contrario, pero venían de pedir rutas que no existen para un media partner (`Programs`, `TrackingLinks` a pelo): el nombre correcto de "programas" aquí es `Campaigns`.

### El bloqueo real: la cuenta está vacía

| Endpoint | Resultado |
|---|---|
| `MediaProperties` | `200` — **total 0** |
| `Campaigns` | `200` — **total 0** |
| `Ads`, `Promotions` | `200` — 0 |

Faltan dos cosas, en este orden:

1. **Dar de alta la web como *media property*.** Es requisito para solicitar programas y, además, `MediaPartnerPropertyId` es un parámetro obligatorio para crear enlaces de tracking. Sin esto no hay nada que hacer.
2. **Solicitar el programa (Coursera y/o Udemy) y que lo aprueben.** Depende de la plataforma, no de nosotros.

### Por qué esto no se puede resolver todavía

Las redes de afiliación aprueban en función de un sitio **publicado y visitable**. Este proyecto corre entero en local y el despliegue es la **Fase 6** (ver `docs/analisis-y-estrategia.md`). Solicitar la afiliación apuntando a `localhost` es tirar la solicitud.

Conclusión: `HU-009` no es solo "está bloqueada", es **prematura**. El orden sensato es desplegar (Fase 6) → dar de alta la propiedad → solicitar programas → implementar `HU-009`.

**Lección, para no repetirla:** un `403` no significa "faltan permisos" hasta comprobar que la ruta existe. Aquí llevó a un diagnóstico equivocado que se corrigió leyendo los scopes reales del token.
