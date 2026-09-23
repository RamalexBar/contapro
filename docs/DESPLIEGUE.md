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
- `VITE_WOMPI_PUBLIC_KEY` (en el servicio `contapro-web`, no `contapro-api`) — la misma llave
  pública de arriba, necesaria para que la sección "Renovación automática" de `/billing` pueda
  tokenizar tarjetas desde el navegador. Al ser un sitio estático (Vite), después de cargarla hay
  que forzar un **rebuild** (no solo un redeploy) para que quede compilada en el bundle.
- `CREDENTIALS_ENCRYPTION_KEY` — necesaria para que una empresa pueda activar el proveedor
  tecnológico MATIAS (facturación electrónica, ver `modules/electronic-invoicing/README.md` punto
  14). Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y
  pegar el resultado tal cual (32 bytes en hex, 64 caracteres). Sin esto, activar MATIAS desde una
  empresa falla con un mensaje claro — el resto de la plataforma sigue funcionando igual.
- `RESEND_API_KEY` / DIAN_* / `ANTHROPIC_API_KEY` — opcionales, dejarlos vacíos si todavía no se
  van a usar (el sistema falla con un mensaje claro en vez de romperse, ver los README de cada
  módulo). `ANTHROPIC_API_KEY` habilita `POST /purchases/extract` (lectura automática de facturas
  de compra, ver `modules/suppliers/README.md`) — conseguirla en console.anthropic.com.
  **`RESEND_API_KEY` sola no basta para que los correos le lleguen a un cliente real**: mientras no
  se verifique un dominio propio en el dashboard de Resend (Domains), la cuenta queda en modo
  sandbox y solo entrega a la dirección con la que te registraste ahí — hace falta comprar un
  dominio, verificarlo en Resend, y actualizar `RESEND_FROM_EMAIL` (hoy en el remitente de pruebas
  `onboarding@resend.dev`).

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

## Dominio propio (contapro.com.co)

Esquema elegido (2026-09-22): `contapro.com.co` (raíz del dominio) → `contapro-web`,
`api.contapro.com.co` → `contapro-api`. Las URLs de `*.onrender.com` siguen funcionando en
paralelo (Render nunca las retira), pero una vez que `CORS_ORIGIN` apunte al dominio propio, la
API deja de aceptar pedidos desde el origen viejo — no hace falta apagar nada a mano, simplemente
dejará de usarse.

1. **En Render, agregar el dominio a cada servicio** (dashboard → `contapro-web` → Settings →
   Custom Domains → Add Custom Domain → `contapro.com.co`; repetir en `contapro-api` con
   `api.contapro.com.co`). Render muestra los registros DNS exactos que hay que crear — puede
   variar según el proveedor, pero en general:
   - `contapro.com.co` (raíz del dominio, sin subdominio) → registro **ALIAS/ANAME** (si el
     proveedor de DNS lo soporta — Namecheap, Cloudflare, DNSimple, etc. sí; GoDaddy no siempre) al
     hostname `*.onrender.com` real de `contapro-web`. Si el proveedor **no** soporta ALIAS/ANAME
     en la raíz, Render da un registro **A** con una IP fija como alternativa.
   - `api.contapro.com.co` (subdominio) → registro **CNAME** normal al hostname `*.onrender.com`
     real de `contapro-api` — esto no tiene la limitación de la raíz, cualquier proveedor lo
     soporta.
2. **Esperar la verificación** — Render revisa el DNS automáticamente cada pocos minutos; una vez
   propagado (minutos a un par de horas según el TTL del proveedor), emite el certificado SSL
   (Let's Encrypt) solo. No hay ningún paso manual de certificado.
3. **Actualizar las variables de entorno** en el dashboard (además de lo que ya quedó en
   `render.yaml`, por si el Blueprint no re-sincroniza servicios ya existentes):
   - `contapro-api` → Environment → `CORS_ORIGIN` = `https://contapro.com.co`
   - `contapro-web` → Environment → `VITE_API_BASE_URL` = `https://api.contapro.com.co/api`
4. **Redeploy manual de `contapro-web`** (mismo motivo del Paso 3 arriba: Vite incrusta
   `VITE_API_BASE_URL` en el bundle en build-time).
5. **Probar**: `https://contapro.com.co` debe cargar la landing, y el login/registro debe llegar
   a `https://api.contapro.com.co/api` sin errores de CORS en la consola del navegador.

**De paso, dos cosas que dependen de tener un dominio propio y que hasta ahora no se podían
resolver** (no son parte de la migración en sí, pero conviene resolverlas ahora que ya hay
dominio):

- **Correos reales con Resend**: mientras `RESEND_API_KEY` no tenga un dominio verificado en el
  dashboard de Resend (Domains), la cuenta queda en modo sandbox y solo entrega al correo con el
  que te registraste ahí (ver Paso 2 arriba). Con `contapro.com.co` ya propio, se puede verificar
  el dominio en Resend (agrega sus propios registros DNS, SPF/DKIM) y actualizar
  `RESEND_FROM_EMAIL` a algo como `notificaciones@contapro.com.co` en vez de
  `onboarding@resend.dev`.
- **Certificado digital de facturación electrónica / cuenta de aliado en Factus**: un dominio
  propio (vs. `*.onrender.com`) suele pedirse como parte de la verificación de identidad de
  negocio en trámites formales — no es un requisito confirmado por Factus todavía, pero vale la
  pena tenerlo en cuenta si piden algo así durante la activación de una empresa cliente.

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
   → debe crear la empresa con una suscripción `TRIALING` de 14 días contra el plan `TRIAL`.
3. Entrar a `https://contapro-web.onrender.com` y loguearse con ese usuario.

También podés probar directo desde la web (iteración 27): entrar a
`https://contapro-web.onrender.com/register` para crear la empresa de prueba sin `curl`, y una vez
logueado, `/billing` ("Mi suscripción") para generar el link de pago Wompi vos mismo, sin que el
operador de la plataforma lo genere a mano (`modules/billing`, permiso `billing.manage`).

## Actualizar despues del primer deploy

Un `git push` a `master` dispara un redeploy automático de `contapro-api`/`contapro-web` (Render
está conectado al repo), y `preDeployCommand` corre `prisma migrate deploy` solo — las migraciones
nuevas quedan aplicadas sin acción manual. Lo que **no** es automático:

- **Planes nuevos/cambiados en `seed-base.ts`** (ej. los 4 planes "Solo Facturación" agregados el
  2026-09-03): un `upsert` en `seed-base.ts` no se ejecuta solo en cada deploy. Hace falta volver
  a correr `pnpm --filter @erp/database run db:seed:production` desde la pestaña **Shell** de
  `contapro-api` en el dashboard de Render (mismo comando del Paso 4) — es seguro re-correrlo,
  hace `upsert` por `code`, no duplica ni borra nada existente.
- **Secretos nuevos** (ej. `CREDENTIALS_ENCRYPTION_KEY` de arriba): agregarlos a mano en el
  dashboard de Render, `contapro-api` → Environment. `render.yaml` con `sync: false` solo crea el
  placeholder vacío la primera vez que se aplica el Blueprint — actualizaciones posteriores de
  `render.yaml` que agregan una key nueva SI la crean vacía en el dashboard, pero el valor real
  sigue habiendo que completarlo a mano ahí.

## Costos aproximados (Render, plan `starter`)

- Postgres `basic-256mb` (Render ya no acepta el plan legacy `starter` en bases nuevas): ~USD 6-7/mes.
- Web service `starter` (`contapro-api`): ~USD 6-7/mes.
- Static site (`contapro-web`): gratis en Render (los sitios estáticos no cobran).

Ajustar el `plan` en `render.yaml` si el volumen de uso lo justifica más adelante (Render permite
subir de plan sin downtime).
