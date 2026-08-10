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

## Estado

En progreso — configuración preparada; pendiente de crear el proyecto en Supabase Cloud y conectar el repositorio en Netlify.
