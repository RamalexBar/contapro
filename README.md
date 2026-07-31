# Contapro — ERP SaaS Colombia

ERP modular multiempresa/multisucursal para pequeños y medianos negocios (tiendas, supermercados,
minimercados, papelerías, ferreterías, boutiques, droguerías) en Colombia. Inspirado en Alegra, Siigo,
World Office y Siesa, construido con Clean Architecture, principios SOLID y diseño modular pensado
para escalar a miles de clientes bajo modalidad SaaS.

> Este repositorio arrancó como **iteración 1** (scaffold completo del monorepo + módulos core
> funcionales) y avanzó módulo por módulo hasta la **iteración 18**: Nómina Colombia (motor de
> liquidación + PDF del desprendible), Contabilidad (plan de cuentas, comprobantes automáticos,
> reportes, cierre de período), Proveedores/Compras (orden de compra, recepción con FIFO real,
> abonos reversables), Facturación electrónica DIAN (los 5 tipos de documento + RIDE), Panel
> administrador SaaS (cobro de suscripciones + recordatorios reales por correo) y Sincronización
> offline en el móvil (ventas). Todos los módulos de negocio tienen API + UI web salvo
> Facturación electrónica (solo API). Ver [`CLAUDE.md`](./CLAUDE.md) para un resumen orientado a
> trabajar con Claude Code y [`docs/ALCANCE.md`](./docs/ALCANCE.md) para el detalle completo,
> módulo por módulo e iteración por iteración.

## Contenido

- [Stack](#stack)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Arquitectura multi-tenant](#arquitectura-multi-tenant)
- [Requisitos previos](#requisitos-previos)
- [Arranque local](#arranque-local)
- [Scripts disponibles](#scripts-disponibles)
- [Solución de problemas](#solución-de-problemas)
- [Estado de verificación](#estado-de-verificación)
- [Documentación](#documentación)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend web | React + Vite + TypeScript + Tailwind CSS |
| App móvil | React Native (Expo) |
| Backend | Node.js + Express + TypeScript (API REST) |
| Base de datos | PostgreSQL + Prisma ORM |
| Offline local | SQLite (móvil) |
| Autenticación | JWT (access + refresh) |
| Almacenamiento | Supabase Storage |

## Estructura del monorepo

```
contapro/
├── apps/
│   ├── api/        # Backend Express + TS (Clean Architecture por módulo)
│   ├── web/        # Frontend React + Vite + TS + Tailwind
│   └── mobile/     # App React Native (Expo) - POS con sincronizacion offline real
├── packages/
│   ├── database/     # Prisma schema (todos los dominios) + seed
│   ├── shared-types/  # DTOs y esquemas zod compartidos
│   ├── shared-utils/  # Formato COP, fechas, validaciones CO
│   └── config/        # tsconfig/eslint/tailwind base
└── docker-compose.yml # Postgres + Adminer para desarrollo local
```

## Arquitectura multi-tenant

Multiempresa (`Company`) y multisucursal (`Branch`) con aislamiento **row-level**: cada tabla de
negocio tiene `companyId`, y una extensión de Prisma Client (`apps/api/src/shared/prisma/tenant.extension.ts`)
inyecta automáticamente el filtro usando el contexto de la request (`AsyncLocalStorage`). Ver
`apps/api/src/shared/prisma/README.md` para la convención de `update`/`delete` por id.

## Requisitos previos

| Herramienta | Versión | Notas |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 20 | incluye `corepack` |
| [pnpm](https://pnpm.io) | 9.x | se activa con `corepack`, no hace falta instalarlo aparte |
| [Docker](https://www.docker.com/) | cualquiera reciente | para levantar Postgres + Adminer local |
| [Git](https://git-scm.com/) | cualquiera reciente | |

Opcional, solo si vas a trabajar en la app móvil:

- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`) y la app **Expo Go** en tu
  teléfono, o un emulador Android/iOS configurado.

## Arranque local

```bash
# 1. Clonar el repositorio
git clone https://github.com/RamalexBar/contapro.git
cd contapro

# 2. Habilitar pnpm (si no lo tienes)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 3. Instalar dependencias de todo el monorepo
pnpm install

# 4. Levantar Postgres local (+ Adminer en http://localhost:8080)
docker compose up -d postgres

# 5. Variables de entorno
cp .env.example apps/api/.env
cp .env.example packages/database/.env
cp .env.example apps/web/.env   # apps/web solo usa VITE_API_BASE_URL

# 6. Migraciones (aplica las 11 migraciones existentes) + seed (crea la empresa demo
#    "Minimarket La Esquina", 2 empleados demo, parametros de nomina 2026 de ejemplo y el
#    operador de plataforma del panel SaaS)
pnpm db:migrate
pnpm db:seed

# 7. Levantar backend y frontend (en dos terminales, o con `pnpm dev` desde la raíz)
pnpm --filter @erp/api dev     # http://localhost:4000
pnpm --filter @erp/web dev     # http://localhost:5173
```

Credenciales del seed: `admin@demo.com` / `Demo1234!` (Administrador), `cajero@demo.com` /
`Demo1234!` (Cajero, límite de descuento 5%, PIN `1234`) y `platform@demo.com` / `Demo1234!`
(panel administrador SaaS, `POST /api/admin/auth/login`, separado de los usuarios de empresa).

Para la app móvil (POS con sincronización offline real, ver
[`apps/api/src/modules/sync/README.md`](./apps/api/src/modules/sync/README.md)):

```bash
pnpm --filter @erp/mobile start
```

## Scripts disponibles

Desde la raíz del monorepo (usan [Turborepo](https://turbo.build) para orquestar todos los paquetes):

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta todos los apps en modo desarrollo |
| `pnpm build` | Compila todos los apps/paquetes |
| `pnpm lint` | Corre ESLint en todo el monorepo |
| `pnpm db:migrate` | Aplica migraciones de Prisma (`packages/database`) |
| `pnpm db:seed` | Siembra la empresa demo |
| `pnpm db:studio` | Abre Prisma Studio para explorar la base de datos |

También puedes apuntar a un solo paquete con `pnpm --filter @erp/<nombre> <script>`, por ejemplo
`pnpm --filter @erp/api dev` o `pnpm --filter @erp/web build`.

## Solución de problemas

- **`corepack: command not found`**: viene incluido con Node ≥ 16.9; si no aparece, actualiza Node
  o instala pnpm manualmente con `npm i -g pnpm@9`.
- **Prisma no encuentra el schema**: el schema está partido en `packages/database/prisma/schema/*.prisma`
  (feature multi-archivo de Prisma); los comandos `db:migrate`/`db:seed`/`db:studio` ya apuntan ahí vía
  `package.json#prisma.schema`, no hace falta pasar `--schema` a mano.
- **Puerto 5432/4000/5173 ocupado**: cambia el puerto en `docker-compose.yml` (Postgres) o en
  `apps/api/.env` (`PORT`) / `apps/web/vite.config.ts` (`server.port`).
- **La app móvil no conecta a la API**: `localhost` no apunta a tu máquina desde un emulador/dispositivo
  físico; usa la IP de tu red local o `expo start --tunnel`, y define `EXPO_PUBLIC_API_BASE_URL`.
- **`EPERM: operation not permitted, rename ... query_engine-windows.dll.node`** (Windows, al correr
  `pnpm db:migrate`/`pnpm db:generate`): el motor de Prisma sigue cargado en memoria porque
  `pnpm --filter @erp/api dev` está corriendo. Detén la API antes de migrar/regenerar, o ignóralo si
  el schema no cambió (el cliente ya cargado sigue siendo válido y `tsx watch` reinicia solo).
- **`Environment variable not found: DATABASE_URL`** al correr comandos de Prisma: falta crear
  `packages/database/.env` (paso 5 de [Arranque local](#arranque-local)); Prisma solo lee el `.env`
  del mismo directorio que `prisma/schema`, no el de la raíz del repo.
- **`EADDRINUSE` en el puerto 4000 tras varios reinicios de la API**: `tsx watch` a veces deja un
  proceso huérfano ocupando el puerto en Windows. Cierra el proceso que lo tiene abierto (`netstat
  -ano | findstr :4000` en PowerShell, o el Administrador de tareas) y vuelve a correr
  `pnpm --filter @erp/api dev`.
- **La API no arranca, se queja de `JWT_PLATFORM_ADMIN_SECRET`**: esa variable es obligatoria (sin
  valor por defecto) desde que existe el panel administrador SaaS — revisa que `apps/api/.env`
  tenga todas las variables de `.env.example` (paso 5), no solo las de la iteración 1.

## Estado de verificación

Cada iteración (1 a 18) se verificó con `tsc --noEmit` + `vitest run` en todo el monorepo y,
salvo cuando no había Docker/Postgres disponible (iteraciones 1 y 2), también en vivo contra una
base real: login, flujo end-to-end del módulo nuevo, y revisión de la respuesta/estado en base de
datos — no solo compilación. Ejemplos recientes: cierre de período contable probado abriendo y
cerrando periodos con comprobantes en distintos estados; reversar abonos a proveedores probado
cancelando una compra con pagos ya registrados y confirmando que el comprobante de cada abono
quedó anulado; sincronización offline móvil probada con pushes idempotentes, conflictos reales y
errores de datos inválidos contra `POST /sync/push`/`GET /sync/pull`.

Dos límites conocidos de verificación, documentados donde corresponde en vez de reportarse como
"probado":

- **Facturación electrónica DIAN**: la generación local de CUFE/XML/firma XAdES está probada, pero
  el envío real al servicio SOAP de la DIAN **no** — faltan credenciales de habilitación reales
  (ver `apps/api/src/modules/electronic-invoicing/README.md`).
- **App móvil**: sin emulador/dispositivo disponible en el entorno de desarrollo de este trabajo,
  el motor de sincronización se verificó con `tsc --noEmit` y probando el backend que consume
  (`POST /sync/push`/`GET /sync/pull`) en vivo, pero no se probó en runtime dentro de la app.

Ver [`CLAUDE.md`](./CLAUDE.md) (sección "Resumen de lo implementado en esta sesión") para el
resumen de las iteraciones más recientes y [`docs/ALCANCE.md`](./docs/ALCANCE.md) para el detalle
de verificación de cada módulo.

## Documentación

- [`CLAUDE.md`](./CLAUDE.md) — guía de orientación (comandos, convenciones, gotchas de este
  entorno) y resumen de las iteraciones más recientes.
- [`docs/ALCANCE.md`](./docs/ALCANCE.md) — qué módulos están funcionales, módulo por módulo e
  iteración por iteración.
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — decisiones de arquitectura y convenciones.
- Cada módulo del backend (`apps/api/src/modules/<modulo>/README.md`) documenta su alcance real:
  qué está implementado, qué falta y limitaciones conocidas.
