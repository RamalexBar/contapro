# Desplegar Contapro en Render

Guía paso a paso para pasar de "corre en mi compu" a una URL real, permanente, en la nube. Define
3 servicios (`render.yaml` en la raíz del repo): base de datos Postgres, backend (`contapro-api`)
y frontend (`contapro-web`, sitio estático).

## Prerrequisitos

- El código tiene que estar en GitHub (ya lo está: `github.com/RamalexBar/contapro`).
- Cuenta de Render con medio de pago activo (el plan `starter` de Postgres/web service no es
  gratis indefinidamente — Render lo factura por uso).

## Paso 1: Crear el Blueprint

1. En [dashboard.render.com](https://dashboard.render.com), **New** → **Blueprint**.
2. Conectar el repo `RamalexBar/contapro`. Render detecta `render.yaml` solo y muestra los 3
   servicios que va a crear (`contapro-db`, `contapro-api`, `contapro-web`).
3. **Apply** — el primer deploy tarda varios minutos (instala todo el monorepo con `pnpm install`,
   no solo un paquete).

## Paso 2: Completar los secretos

`render.yaml` deja **vacíos a propósito** (`sync: false`) los secretos reales — nunca quedan en
el repo. En el dashboard de `contapro-api` → **Environment**, completar los que vayas a usar:

- `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_INTEGRITY_SECRET` / `WOMPI_EVENTS_SECRET` —
  **usar las llaves de PRODUCCIÓN** (`pub_prod_...`/`prv_prod_...`), no las de sandbox
  (`pub_test_...`) que se usaron para probar el flujo en desarrollo. Conseguirlas en
  comercios.wompi.co una vez el comercio esté activado para cobrar de verdad.
- `RESEND_API_KEY` / DIAN_* — opcionales, dejarlos vacíos si todavía no se van a usar (el sistema
  falla con un mensaje claro en vez de romperse, ver los README de cada módulo).

Sin `WOMPI_PUBLIC_KEY`/`WOMPI_INTEGRITY_SECRET`, generar un link de cobro (`POST
/admin/subscriptions/:id/checkout`) responde 422 con el mensaje "WOMPI_PUBLIC_KEY/... no estan
configurados" — no un error opaco.

## Paso 3: Verificar las URLs reales

`render.yaml` asume que a `contapro-api`/`contapro-web` les toca exactamente esos nombres en la
URL (`https://contapro-api.onrender.com`). Si alguien más ya tiene ese nombre en Render, tu
instancia recibe un sufijo distinto. Revisar en el dashboard la URL real de cada servicio y, si no
coincide:

1. En `contapro-api` → Environment → `CORS_ORIGIN` → pegar la URL real de `contapro-web`.
2. En `contapro-web` → Environment → `VITE_API_BASE_URL` → pegar la URL real de `contapro-api` +
   `/api`.
3. **Redeploy manual de `contapro-web`** después de cambiar `VITE_API_BASE_URL` — Vite lo
   incrusta en el bundle en tiempo de build, cambiar la variable sin reconstruir no tiene efecto.

## Paso 4: Sembrar la base de datos

**Nunca correr el seed de desarrollo (`pnpm db:seed`) contra producción** — crea una empresa de
ejemplo con usuarios de contraseña pública conocida (`Demo1234!`) y un `PlatformAdmin` igual de
público (`platform@demo.com`). Usar en cambio, desde la pestaña **Shell** de `contapro-api` en el
dashboard de Render:

```bash
pnpm --filter @erp/database run db:seed:production
```

Esto siembra **solo** infraestructura (permisos, roles de sistema, los 4 planes de suscripción de
`docs/PRECIOS.md`) — nada de empresas ni contraseñas conocidas. Después, crear el primer
`PlatformAdmin` real (el operador de la plataforma — vos):

```bash
pnpm --filter @erp/database exec tsx prisma/create-platform-admin.ts tu-email@real.com "unaContraseñaFuerte123!" "Tu Nombre"
```

(`create-platform-admin.ts` también sirve para resetear la contraseña de un admin existente si
hace falta — es un upsert por email.)

## Paso 5: Probar

1. `POST https://contapro-api.onrender.com/api/admin/auth/login` con las credenciales del paso 4
   → debe dar `200` con un `accessToken`.
2. `POST https://contapro-api.onrender.com/api/auth/register-company` con los datos de una
   empresa de prueba (`companyName`, `legalName`, `nit`, `companyEmail`, `adminFullName`,
   `adminEmail`, `adminPassword` — ver `apps/api/src/modules/auth/interfaces/auth.validators.ts`)
   → debe crear la empresa con una suscripción `TRIALING` de 30 días contra el plan `TRIAL`.
3. Entrar a `https://contapro-web.onrender.com` y loguearse con ese usuario.

**Importante — esto todavía se prueba con `curl`, no hay pantalla de registro en la web.** La
pieza que falta para que un cliente nuevo pueda "instalarse solo" (entrar a un link y crear su
cuenta sin ayuda) es una pantalla pública de registro en `apps/web` que llame a
`POST /auth/register-company`, y una pantalla de "Mi suscripción" donde la propia empresa pueda
generar su link de pago Wompi sin que el operador de la plataforma lo genere a mano — hoy
`POST /admin/subscriptions/:id/checkout` solo lo puede llamar un `PlatformAdmin`
(`requirePlatformAdmin`), no la empresa misma. Ver el punto 4 de "Que falta implementar" en
`apps/api/src/modules/saas-admin/README.md`.

## Costos aproximados (Render, plan `starter`)

- Postgres `starter`: ~USD 6-7/mes.
- Web service `starter` (`contapro-api`): ~USD 6-7/mes.
- Static site (`contapro-web`): gratis en Render (los sitios estáticos no cobran).

Ajustar el `plan` en `render.yaml` si el volumen de uso lo justifica más adelante (Render permite
subir de plan sin downtime).
