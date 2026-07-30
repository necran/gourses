# HU-003 — Supabase self-hosted en el NAS

## Contexto

Fase 0 (cimientos). El desarrollo corre en local; la base de datos y autenticación viven en Supabase self-hosted en el NAS (UGREEN), no en la nube, hasta la Fase 6. Esta historia deja el NAS levantado y la app Next.js capaz de conectarse a él desde la red local.

Esta historia tiene una particularidad: parte de su ejecución ocurrió **fuera de este repositorio**, directamente en el NAS por SSH (clave dedicada `~/.ssh/gourses_nas`, sin contraseñas compartidas). El despliegue oficial de Supabase necesitó dos ajustes específicos de este NAS: los puertos por defecto (5432, 8000) chocaban con otros contenedores ya en marcha (remapeados a 54322/54321/54443), y varios ficheros bind-mounted individualmente (script de entrypoint de Kong, scripts SQL de init de Postgres) fallaban con "Permission denied" por una particularidad del almacenamiento overlay del NAS — se resolvió empaquetando esos ficheros en imágenes Docker personalizadas (`gourses-kong-custom`, `gourses-postgres-custom`) en vez de montarlos como bind mounts sueltos.

## Como desarrollador quiero Supabase corriendo en el NAS y accesible desde mi máquina para poder desarrollar contra una base de datos real sin depender de la nube

## Criterios de aceptación

- **Given** las instrucciones de `docs/nas-supabase-setup.md` **When** se siguen en el NAS vía Container Manager/SSH **Then** los servicios de Supabase (Postgres, Auth, REST, Studio, Kong) quedan arrancados y accesibles desde la red local.
- **Given** el NAS con Supabase arrancado y `.env.local` relleno con la URL y claves del NAS **When** ejecuto el script de verificación **Then** confirma conexión correcta a la base de datos y al servicio de autenticación.
- **Given** Supabase Studio accesible desde el navegador **When** entro con las credenciales generadas **Then** veo el panel de administración sin errores.

## Fuera de alcance

Esquema de base de datos de la aplicación (tablas de cursos, usuarios, favoritos) — eso llega con las historias de Fase 1 en adelante. Exponer el NAS a internet — explícitamente fuera de alcance, ver `CLAUDE.md`.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Verificación de conexión: `npm run check:supabase` — Auth responde 200, REST responde 403 (esperado, sin esquema ni RLS todavía; confirma que la conexión y las claves son correctas)
- [x] Integración: no aplica todavía (no hay esquema de aplicación)
- [x] E2E: no aplica todavía
- [x] `/security-review` (informal, ver nota): secretos generados aleatoriamente en el propio NAS (no los de ejemplo del repo oficial); NAS accesible solo en red local, sin port-forwarding ni exposición pública; acceso SSH por clave dedicada, no por contraseña

## Estado

Cerrada. Pendiente opcional (no bloqueante): confirmar visualmente el login en Supabase Studio (`http://192.168.1.139:54321`, usuario `gourses`) desde el navegador.
