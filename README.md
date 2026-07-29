# Contapro — ERP SaaS Colombia

ERP modular multiempresa/multisucursal para pequeños y medianos negocios (tiendas, supermercados,
minimercados, papelerías, ferreterías, boutiques, droguerías) en Colombia. Inspirado en Alegra, Siigo,
World Office y Siesa, construido con Clean Architecture, principios SOLID y diseño modular pensado
para escalar a miles de clientes bajo modalidad SaaS.

> Este repositorio arrancó como **iteración 1** (scaffold completo del monorepo + módulos core
> funcionales), en la **iteración 2** se implementó Nómina Colombia (motor de liquidación real,
> ver `apps/api/src/modules/payroll/README.md`) junto con Empleados (CRUD) y Control de horarios
> (marcación de entrada/salida), y en la **iteración 3** se implementó Contabilidad (plan de
> cuentas, comprobantes, contabilización automática de nómina/venta/compra, reportes) y un
> registro mínimo de Proveedores/Compras (ver `apps/api/src/modules/accounting/README.md` y
> `apps/api/src/modules/suppliers/README.md`). Ver [`docs/ALCANCE.md`](./docs/ALCANCE.md) para el
> detalle de qué está implementado y qué queda modelado (Prisma) para siguientes iteraciones.

## Contenido

- [Stack](#stack)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Arquitectura multi-tenant](#arquitectura-multi-tenant)
- [Requisitos previos](#requisitos-previos)
- [Arranque local](#arranque-local)
- [Scripts disponibles](#scripts-disponibles)
- [Solución de problemas](#solución-de-problemas)
- [Estado de verificación de esta sesión](#estado-de-verificación-de-esta-sesión)
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
│   └── mobile/     # App React Native (Expo) - scaffold
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

# 6. Migraciones + seed (crea la empresa demo "Minimarket La Esquina", 2 empleados demo y los
#    parametros de nomina 2026 de ejemplo)
pnpm db:migrate --name init
pnpm db:seed

# 7. Levantar backend y frontend (en dos terminales, o con `pnpm dev` desde la raíz)
pnpm --filter @erp/api dev     # http://localhost:4000
pnpm --filter @erp/web dev     # http://localhost:5173
```

> Si ya habías corrido `pnpm db:migrate --name init` en una clonación anterior a la iteración 2
> (antes de que existiera `PayrollParameter.monthlyHoursDivisor`), corre
> `pnpm db:migrate --name add_payroll_hours_divisor` para traer tu base de datos al día.

Credenciales del seed: `admin@demo.com` / `Demo1234!` (Administrador) y `cajero@demo.com` / `Demo1234!`
(Cajero, límite de descuento 5%, PIN `1234`).

Para la app móvil (scaffold, ver [alcance](./docs/ALCANCE.md#-móvil-expo)):

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

## Estado de verificación de esta sesión

**Iteraciones 1 y 2**: verificadas por `tsc --noEmit` y `prisma generate` sin errores en todo el
monorepo. En esas sesiones no había Docker/PostgreSQL disponibles, así que los flujos end-to-end
quedaron pendientes de correr contra una base real.

**Iteración 3** (Contabilidad + Proveedores/Compras minimo): con Docker ya disponible en esta
máquina, se levantó Postgres real (`docker compose up -d`), se corrieron las migraciones y el seed,
y se probó en vivo contra la API (no solo compilación):

- ✅ Login (`admin@demo.com`) devuelve JWT con los permisos `accounting.*`/`suppliers.*` sembrados.
- ✅ Venta completa (`POST /api/sales`, pago CASH) genera y postea automáticamente el comprobante:
  débito Caja, crédito Ingresos por ventas + IVA generado.
- ✅ Proveedor + compra (`POST /api/suppliers`, `POST /api/purchases`) genera y postea el
  comprobante: débito Inventario + IVA descontable, crédito Proveedores nacionales.
- ✅ Venta y compra netean correctamente en la misma cuenta de IVA (2408) — confirmado en el libro
  mayor (`GET /api/reports/ledger/:accountId`).
- ✅ Balance General (`GET /api/reports/balance-sheet`) cuadra: activos = pasivos + patrimonio.

Pendiente de verificar por ti:

- Probar la app web (`http://localhost:5173`) en el navegador — la API ya quedó confirmada
  funcionando correctamente para los flujos que consume el front (empleados, vacaciones/permisos,
  incapacidades, ausencias, refresh de sesión).
- Flujo end-to-end de nómina: `POST /employees` → `POST /time-entries/clock-in` +
  `/clock-out` → `POST /payrolls` → `POST /payrolls/:id/calculate` → `approve` (ahora también
  contabiliza automáticamente, ver `apps/api/src/modules/accounting/README.md`) → `pay`.

## Documentación

- [`docs/ALCANCE.md`](./docs/ALCANCE.md) — qué módulos están funcionales vs. modelados (stub).
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — decisiones de arquitectura y convenciones.
- Cada módulo stub del backend (`apps/api/src/modules/<modulo>/README.md`) documenta su alcance
  planeado y los modelos Prisma ya preparados para implementarlo.
