# HU-014 — Desplegar el sitio en producción

## Contexto

Fase 6. Todo lo construido hasta ahora (portada, buscador, fichas, 413 cursos, páginas legales) **solo existe en local**. `gourses.com` resuelve a un servidor de IONOS donde no hay nada publicado, y ni siquiera tiene HTTPS configurado.

Decisiones ya tomadas y razonadas en `docs/analisis-y-estrategia.md`:

| Pieza | Elección |
|---|---|
| Ejecución de la app | **Netlify**, plan gratuito (permite uso comercial; Vercel Hobby no) |
| Base de datos | **Supabase Cloud**, plan gratuito (el NAS no se expone a internet, por regla del proyecto) |
| Dominio | **gourses.com**, registrado en IONOS, apuntando por DNS a Netlify |

El alojamiento web de IONOS no se usa: no soporta Node.js. De IONOS solo se aprovechan el dominio y el correo.

## Como titular del proyecto quiero que la web esté publicada en gourses.com para que cualquiera pueda usarla y para poder solicitar la afiliación con un sitio real

## Criterios de aceptación

- **Given** el proyecto en GitHub **When** se hace push a `main` **Then** Netlify construye y publica la versión nueva sin intervención manual.
- **Given** el sitio publicado **When** visito `https://gourses.com` **Then** carga la portada por HTTPS, con certificado válido y sin avisos del navegador.
- **Given** el sitio publicado **When** busco y abro una ficha **Then** los datos vienen de la base de datos en la nube, no del NAS.
- **Given** la base de datos en la nube **When** se despliega por primera vez **Then** tiene aplicadas las mismas migraciones y las mismas políticas de seguridad a nivel de fila que en desarrollo.
- **Given** el sitio publicado **When** inspecciono lo que llega al navegador **Then** no aparece ninguna credencial de servidor: ni la clave de servicio de Supabase, ni la cadena de conexión, ni las claves de Udemy o Impact.

## Fuera de alcance

- **Ingesta programada en producción**: va en `HU-015`. Para esta historia basta con volcar el catálogo actual una vez.
- Analítica, monitorización o alertas de caída.
- Entorno de preproducción separado.
- Cancelar o cambiar el plan de hosting de IONOS: es una decisión económica del titular, no técnica.

## Riesgos y cuidados

- **Las credenciales de producción no entran en el repositorio.** Van en las variables de entorno de Netlify y en los secretos de GitHub Actions. `.env.local` sigue siendo solo local.
- **La base de datos de producción arranca vacía.** Hay que aplicar las migraciones y volcar el catálogo antes de apuntar el dominio, o el sitio se publicaría sin un solo curso.
- **El plan gratuito de Supabase pausa el proyecto tras un periodo de inactividad.** Conviene saberlo antes de que ocurra y no descubrirlo con el sitio caído.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Verificación de que las migraciones y la RLS están aplicadas en la base de la nube (mismo test de integración que en `HU-004`, apuntando a producción)
- [ ] E2E contra el sitio publicado: portada, búsqueda y ficha funcionando en `https://gourses.com`
- [ ] Comprobación de que ninguna credencial de servidor aparece en el HTML ni en el JavaScript servido al navegador
- [ ] `/security-review` sin hallazgos críticos ni altos

## Notas de implementación

- **Base de datos**: proyecto `gourses` en Supabase Cloud (`eu-west-1`), separado del proyecto de finanzas que ya existía en la misma cuenta. Se comprobó antes de tocar nada: aquel tenía tablas de banca en producción y aplicar ahí las migraciones habría sido un destrozo.
- **Conexión**: hay que usar el *pooler* (`aws-1-eu-west-1.pooler.supabase.com:5432`). La conexión directa de Supabase es **solo IPv6** y no se alcanza desde una red IPv4 normal. El host del pooler se encontró probando variantes; el que aparece por defecto en la documentación (`aws-0-…`) devuelve "tenant not found".
- **Puerto 5432 y no 6543**: el 6543 es el pooler en modo transacción y no admite sentencias preparadas, que es lo que necesitan las migraciones y los jobs.
- **Seguridad verificada de extremo a extremo** contra la base real: `SELECT` anónimo devuelve 200, `INSERT` anónimo devuelve 401 por RLS.
- Las variables `NEXT_PUBLIC_*` se incrustan **en tiempo de compilación**, así que tras configurarlas en Netlify hay que relanzar el despliegue; no basta con guardarlas.
- Visibilidad: producción pública y previsualizaciones privadas, para que el trabajo sin terminar no sea accesible ni indexable.

### El escollo del DNS en IONOS (para no repetirlo)

Editar el registro `A` desde el panel DNS **fallaba en silencio**: el formulario aceptaba el cambio, mostraba la vista previa correcta, y al guardar no pasaba nada. Ni error ni aviso. Se comprobó consultando el servidor autoritativo directamente, no solo el panel.

La causa no era el aviso de "confirme su correo" (primera hipótesis, equivocada), sino que los registros `A` y `AAAA` pertenecían al servicio **"Default Site"** de IONOS. Los registros gestionados por un servicio no se pueden editar sueltos.

La solución: en el panel DNS, acción **"Desactivar servicio"** sobre ese registro. Desactiva solo `A`, `AAAA` y un `TXT` de IONOS — **no toca MX, SPF, DKIM ni DMARC**, así que el correo del dominio sigue funcionando. Después ya se pueden añadir los registros propios con normalidad.

Registros finales: `A @` y `A www` → `75.2.60.5`, sin `AAAA`. Se eliminó el `AAAA` a propósito: si se deja apuntando a IONOS, quien navegue por IPv6 seguiría llegando al servidor antiguo aunque el resto esté bien configurado.

## Estado

Cerrada en lo que depende de la configuración. El certificado HTTPS lo emite Netlify automáticamente cuando termine de propagarse el DNS (el TTL anterior era de una hora).
