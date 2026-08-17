# HU-018 — Cuentas de usuario

## Contexto

Fase 3, y el primer punto del proyecto donde hay **datos de personas**. Hasta ahora todo era catálogo público: la RLS solo tenía que permitir leer. A partir de aquí tiene que separar lo de cada uno.

Existe para desbloquear los favoritos (`HU-019`) y, tras ellos, las alertas de precio (Fase 4): sin usuarios no hay a quién avisar de una bajada, y el histórico de precios lleva acumulándose desde `HU-004` sin nadie a quien servir.

Decisión ya tomada: **acceso por enlace mágico**, sin contraseñas. Motivos concretos:

- No se guardan contraseñas, así que no hay contraseñas que filtrar ni que alguien reutilice de otro sitio.
- No hace falta flujo de recuperación, que es donde suelen aparecer los agujeros.
- `CLAUDE.md` ya obliga a delegar la autenticación en Supabase Auth y a no reimplementar sesiones ni hashing a mano.

Requisito externo verificado (2026-08-11): **el correo integrado de Supabase admite 2 mensajes por hora en todo el proyecto** y su documentación dice explícitamente que no sirve para producción. Hace falta un proveedor SMTP propio; se usará **Resend**, que además se necesita en la Fase 4 para las alertas.

## Como visitante quiero crear una cuenta y entrar en ella con solo mi correo para poder guardar cosas sin inventarme otra contraseña

## Criterios de aceptación

- **Given** la página de acceso **When** introduzco mi correo y lo envío **Then** se me confirma que se ha enviado un enlace, sin revelar si ese correo ya tenía cuenta o no.
- **Given** un enlace de acceso válido **When** lo abro **Then** entro en mi cuenta y el sitio me reconoce en las páginas siguientes.
- **Given** que he entrado **When** cierro sesión **Then** dejo de estar identificado y las páginas privadas vuelven a pedir acceso.
- **Given** que no he entrado **When** abro una página que requiere cuenta **Then** se me lleva a la de acceso en vez de mostrar un error.
- **Given** un correo con formato inválido **When** lo envío **Then** se me indica el problema y no se envía nada.
- **Given** cualquier página del sitio **When** la miro **Then** sé si estoy dentro o fuera, y tengo a mano entrar o salir.

## Fuera de alcance

- **Favoritos**: son `HU-019`. Esta historia deja la autenticación funcionando y una página privada mínima que lo demuestre.
- Perfil de usuario, nombre, avatar o preferencias: no se piden datos que no se necesitan.
- Entrar con Google u otros proveedores.
- Borrado de cuenta desde la interfaz: se anota como pendiente, ya que el RGPD reconoce ese derecho y de momento se atiende por correo, como dice la política de privacidad.

## Obligación legal que entra con esta historia

La política de privacidad publicada afirma hoy:

> *"No hay registro ni cuentas de usuario, así que no pedimos nombre ni correo."*

En cuanto exista el acceso, **eso es falso**. Actualizar ese texto forma parte de esta historia, no de una posterior: no se puede desplegar la autenticación dejando publicada una declaración de privacidad que miente. Habrá que declarar qué se guarda (el correo y poco más), para qué, con qué base jurídica y durante cuánto tiempo.

## Cuidados

- **Las claves de servicio no llegan al navegador.** La sesión se maneja con la clave anónima y las cookies que gestiona Supabase; `SUPABASE_SERVICE_ROLE_KEY` sigue siendo solo de servidor, y de hecho hoy no la usa nadie.
- **El enlace mágico es una credencial**: no debe aparecer en registros ni en direcciones que se compartan.
- **No filtrar qué correos tienen cuenta.** La respuesta debe ser la misma exista o no, o la página se convierte en un comprobador de quién está registrado.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: validación del correo antes de enviar nada
- [x] Unitarios: la cookie de sesión se emite con `httpOnly` (fija el default de `@supabase/ssr`, que es `false`)
- [x] Integración: un enlace de acceso generado contra Supabase real permite establecer sesión
- [x] E2E: enviar el formulario muestra la confirmación; una página privada redirige a acceso cuando no hay sesión; cerrar sesión deja de identificar
- [x] E2E: la política de privacidad ya no afirma que no hay cuentas
- [x] `/security-review` sin hallazgos críticos ni altos
- [x] **Suite completa en verde**, tres pasadas seguidas para descartar intermitencias

## Estado

**Cerrada.**

- Unitarios: 190 pasan.
- Integración: 39 pasan.
- E2E: 43 pasan en 3 pasadas seguidas (~12 s cada una). Queda 1 saltado a propósito,
  el del envío real de correo, que espera a tener SMTP propio.
- Revisión de seguridad: sin hallazgos críticos ni altos.

## Hallazgos de la revisión de seguridad

Un solo candidato, **descartado** en el filtrado por confianza insuficiente (6/10 sobre
un umbral de 8): las cookies de sesión salían sin `httpOnly`. La cadena de explotación
que se le atribuía (XSS → robo del token de refresco) resultó falsa: el único
`dangerouslySetInnerHTML` del sitio es el JSON-LD de la ficha, que pasa por
`serializeStructuredData` y escapa `<` y `>`.

Aun así se corrigió, porque cuesta una línea y **nada en el repo lee la sesión desde el
navegador** (no hay `createBrowserClient`), así que poner `httpOnly` no rompe nada.
Dentro de esa cookie viaja el token de refresco, que dura meses. Se añadió test que
falla si el default de la librería vuelve.

De paso: `netlify.toml` afirmaba en un comentario que el sitio no usa cookies propias
—ya no es cierto— y le faltaba HSTS, que ahora sí importa porque una primera visita
por `http://` dejó de ser inofensiva. Ambas cosas corregidas.

También se amplió `.gitignore`: solo cubría `.env.local`, así que un `.env.local.bak`
—que lleva las mismas claves dentro— quedaba listo para commitear por accidente.

## Dos trampas de entorno que costaron tiempo

Ninguna era un fallo del código, pero las dos se disfrazaron de uno:

1. **Un servidor fantasma.** Un `next start` de una medición previa seguía ocupando el
   puerto 3000, y `reuseExistingServer` hacía que Playwright probara contra ese build
   viejo. De ahí fallos incoherentes y pasadas de 16–26 min. Ojo: `pkill -f "next start"`
   no lo mata, porque el proceso se llama `next-server`.
2. **`COURSERA_CATALOG_API_BASE_URL` truncada** a `https:/` en `.env.local`, lo que
   reventaba 5 tests de integración con un `Invalid URL` que parecía de la ingesta.

Y una lección de los tests: varios e2e del comparador leían con `count()`,
`allTextContents()` y `page.url()` justo después del clic. Esas llamadas **no
reintentan**, así que leían todavía `/buscar`. Iban pasando por suerte con el servidor
lento; al arreglar el entorno y volverse todo rápido, la carrera empezó a perderse.
Se centralizó la espera en un ayudante (`compararDosPrimeros`) para matar la clase
entera de carrera, no solo el caso que falló.
