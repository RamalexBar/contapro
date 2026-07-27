# ERP SaaS Colombia

ERP modular multiempresa/multisucursal para pequeños y medianos negocios (tiendas, supermercados,
minimercados, papelerías, ferreterías, boutiques, droguerías) en Colombia. Inspirado en Alegra, Siigo,
World Office y Siesa, construido con Clean Architecture, principios SOLID y diseño modular pensado
para escalar a miles de clientes bajo modalidad SaaS.

> Este repositorio corresponde a la **iteración 1**: scaffold completo del monorepo + módulos core
> funcionales. Ver [`docs/ALCANCE.md`](./docs/ALCANCE.md) para el detalle de qué está implementado y
> qué queda modelado (Prisma) para siguientes iteraciones.

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
erp-saas-colombia/
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

## Arranque local

```bash
# 1. Habilitar pnpm (si no lo tienes)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 2. Instalar dependencias
pnpm install

# 3. Levantar Postgres local
docker compose up -d postgres

# 4. Variables de entorno
cp .env.example apps/api/.env
cp .env.example packages/database/.env
cp .env.example apps/web/.env   # solo usa VITE_API_BASE_URL

# 5. Migraciones + seed (empresa demo)
pnpm db:migrate --name init
pnpm db:seed

# 6. Levantar backend y frontend
pnpm --filter @erp/api dev     # http://localhost:4000
pnpm --filter @erp/web dev     # http://localhost:5173
```

Credenciales del seed: `admin@demo.com` / `Demo1234!` (Administrador) y `cajero@demo.com` / `Demo1234!`
(Cajero, límite de descuento 5%).

## Estado de verificación de esta sesión

Este entorno de generación no tiene Docker ni PostgreSQL disponibles, así que no se pudo correr
`prisma migrate` ni probar los endpoints en vivo. Lo que sí se verificó automáticamente:

- ✅ `pnpm install` en todo el monorepo (workspaces resueltos correctamente).
- ✅ `prisma generate` — el schema completo (todos los dominios) valida sin errores.
- ✅ `tsc --noEmit` sin errores en `apps/api`, `apps/web`, `packages/database`,
  `packages/shared-types` y `packages/shared-utils`.

Pendiente de verificar por ti (requiere Postgres — ver sección "Arranque local"): las migraciones,
el seed, y los flujos end-to-end (login, crear producto, abrir caja, venta con/sin autorización de
descuento) descritos en `docs/ALCANCE.md`.

## Documentación

- [`docs/ALCANCE.md`](./docs/ALCANCE.md) — qué módulos están funcionales vs. modelados (stub).
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — decisiones de arquitectura y convenciones.
- Cada módulo stub del backend (`apps/api/src/modules/<modulo>/README.md`) documenta su alcance
  planeado y los modelos Prisma ya preparados para implementarlo.
