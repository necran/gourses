# HU-003 — Supabase self-hosted en el NAS

## Contexto

Fase 0 (cimientos). El desarrollo corre en local; la base de datos y autenticación viven en Supabase self-hosted en el NAS (UGREEN), no en la nube, hasta la Fase 6. Esta historia deja el NAS levantado y la app Next.js capaz de conectarse a él desde la red local.

Esta historia tiene una particularidad: parte de su ejecución ocurre **fuera de este repositorio**, en el propio NAS, porque no hay acceso remoto configurado desde el entorno donde trabaja Claude Code. Por eso no se cierra solo con código — se cierra cuando el usuario confirma que el script de verificación conecta correctamente.

## Como desarrollador quiero Supabase corriendo en el NAS y accesible desde mi máquina para poder desarrollar contra una base de datos real sin depender de la nube

## Criterios de aceptación

- **Given** las instrucciones de `docs/nas-supabase-setup.md` **When** se siguen en el NAS vía Container Manager/SSH **Then** los servicios de Supabase (Postgres, Auth, REST, Studio, Kong) quedan arrancados y accesibles desde la red local.
- **Given** el NAS con Supabase arrancado y `.env.local` relleno con la URL y claves del NAS **When** ejecuto el script de verificación **Then** confirma conexión correcta a la base de datos y al servicio de autenticación.
- **Given** Supabase Studio accesible desde el navegador **When** entro con las credenciales generadas **Then** veo el panel de administración sin errores.

## Fuera de alcance

Esquema de base de datos de la aplicación (tablas de cursos, usuarios, favoritos) — eso llega con las historias de Fase 1 en adelante. Exponer el NAS a internet — explícitamente fuera de alcance, ver `CLAUDE.md`.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Verificación de conexión: `scripts/check-supabase-connection.mjs` conecta correctamente contra el NAS (requiere que el usuario lo ejecute con el NAS levantado — no se puede automatizar desde aquí sin acceso remoto)
- [ ] Integración: no aplica todavía (no hay esquema de aplicación)
- [ ] E2E: no aplica todavía
- [ ] `/security-review`: revisar que los secretos generados no sean los de ejemplo del repositorio oficial de Supabase, y que el NAS no esté expuesto a internet

## Estado

Bloqueada — pendiente de que el usuario despliegue Supabase en el NAS siguiendo `docs/nas-supabase-setup.md` y confirme el resultado del script de verificación.
