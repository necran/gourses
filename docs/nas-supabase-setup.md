# Desplegar Supabase self-hosted en el NAS (UGREEN)

> **Estado: ya desplegado** (HU-003, cerrada). Este documento queda como referencia de cómo se hizo y cómo repetirlo si hace falta reconstruirlo. Corre en `/volume1/docker/gourses-supabase` en el NAS (`192.168.1.139`), accesible por SSH con la clave `~/.ssh/gourses_nas`.

Sigue la guía oficial de Supabase, no un `docker-compose.yml` hecho a mano — es la forma de no dejar secretos por defecto ni una configuración desactualizada. Esto se ejecuta en el NAS, no en este repositorio.

## Puertos reales usados (remapeados)

Este NAS ya tenía otros contenedores ocupando los puertos por defecto de Supabase (5432 y 8000). Los puertos finales son:

- Kong (API gateway, lo que usa la app): **54321** (HTTP) / **54443** (HTTPS)
- Pooler (Supavisor, `POSTGRES_PORT` del `.env`): **54322** — requiere formato de conexión con tenant id (`postgres.<tenant>`), no válido para una conexión directa simple.
- Postgres directo (añadido en HU-004 para scripts de migración/tests): host **54332** → contenedor **54322** (ojo: dentro del contenedor Postgres escucha en 54322, no en el 5432 por defecto, porque el `.env` del NAS fija `PGPORT=54322`). Mapeo añadido a mano en `docker-compose.yml`, servicio `db`, ya que por defecto ese servicio no publica ningún puerto al host.
- `NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.139:54321`
- `DATABASE_URL` / `TEST_DATABASE_URL` (solo scripts, nunca cliente): `postgres://postgres:<POSTGRES_PASSWORD>@192.168.1.139:54332/postgres` y `.../gourses_test` respectivamente.

## Aviso sobre bind mounts de ficheros individuales

En este NAS, montar un **fichero individual** (no un directorio) como bind mount dentro de un contenedor falla con `Permission denied`, aunque los permisos en el host sean 777 — es una particularidad del almacenamiento del NAS, no un error de configuración nuestro. Afectó al entrypoint de Kong y a los scripts SQL de init de Postgres.

**Solución aplicada:** en vez de bind-montar esos ficheros sueltos, se empaquetan dentro de imágenes Docker personalizadas mediante `COPY` en un `Dockerfile`:
- `kong-custom/Dockerfile` → imagen `gourses-kong-custom:3.9.1`
- `db-custom/Dockerfile` → imagen `gourses-postgres-custom:17.6.1.136`

Si en el futuro hay que reconstruir el stack desde cero y aparece el mismo `Permission denied` en algún otro servicio con ficheros bind-mounted, aplicar el mismo patrón: copiar el fichero a una carpeta `<servicio>-custom/`, escribir un `Dockerfile` mínimo `FROM <imagen original>` + `COPY`, construirlo con `docker build`, y apuntar `image:` a la imagen nueva en `docker-compose.yml`, quitando el bind mount de ese fichero.

## Base de datos de test

Para no correr tests de integración contra la base de desarrollo (regla en `.claude/rules/testing.md`), se creó una base `gourses_test` en el mismo Postgres del NAS:

```bash
docker compose exec -T db psql -U postgres -c 'CREATE DATABASE gourses_test;'
```

Las migraciones (`supabase/migrations/`) se aplican por separado a cada una vía `DATABASE_URL`/`TEST_DATABASE_URL` y `npm run migrate`.

## 1. Acceder al NAS

Desde UGOS: abre **Container Manager** (o **SSH** si lo tienes habilitado en Panel de Control → Terminal & SNMP).

Si usas SSH:

```bash
ssh tu_usuario@IP_DEL_NAS
```

## 2. Descargar la configuración oficial de Supabase

En una carpeta de tu NAS con espacio suficiente (ej. un volumen compartido dedicado a Docker):

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

## 3. Generar secretos propios (obligatorio — nunca usar los de ejemplo)

El `.env` de ejemplo trae una clave JWT y contraseñas de muestra. Hay que sustituirlas antes de arrancar nada:

- `POSTGRES_PASSWORD`: contraseña nueva y fuerte.
- `JWT_SECRET`: cadena aleatoria de al menos 32 caracteres.
- `ANON_KEY` y `SERVICE_ROLE_KEY`: se generan a partir del `JWT_SECRET` con el generador que Supabase enlaza en su propia documentación de self-hosting — no se inventan a mano.
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`: credenciales de acceso a Supabase Studio.

Guarda estos valores en un gestor de contraseñas. Se necesitarán también en el `.env.local` del proyecto Next.js (paso 5).

## 4. Levantar los servicios

```bash
docker compose up -d
```

Comprueba que todos los contenedores están sanos:

```bash
docker compose ps
```

Si prefieres hacerlo desde la interfaz gráfica: en Container Manager, usa "Crear proyecto" → apuntar al mismo `docker-compose.yml` y `.env` generados en el paso 2 y 3.

## 5. Conectar el proyecto Next.js

En tu máquina de desarrollo, copia `.env.example` a `.env.local` (si no lo has hecho ya) y rellena:

```
NEXT_PUBLIC_SUPABASE_URL=http://IP_DEL_NAS:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY del paso 3>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY del paso 3>
```

`8000` es el puerto de Kong (el API gateway de Supabase) por defecto — ajusta si lo cambiaste en el `.env` del NAS.

## 6. Verificar la conexión

Desde la raíz del proyecto:

```bash
node scripts/check-supabase-connection.mjs
```

Debe confirmar conexión correcta a la base de datos y al servicio de autenticación. Si falla, revisa: que el NAS y tu máquina estén en la misma red, que el firewall del NAS permita el puerto de Kong, y que las claves en `.env.local` coincidan exactamente con las generadas en el paso 3.

## Seguridad — no negociable

- El NAS **no** se expone a internet (sin port-forwarding del puerto de Supabase, sin DDNS apuntando a él). Solo accesible en red local mientras estemos en Fase 0–5.
- Nunca commitear `.env.local` ni el `.env` del NAS — ambos están para credenciales reales.
- Antes de dar por cerrada esta historia, pasar `/security-review` sobre esta configuración.
