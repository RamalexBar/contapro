# Arquitectura

## Monorepo

pnpm workspaces + Turborepo. `apps/*` son desplegables (api, web, mobile). `packages/*` son librerías
internas consumidas por los apps (`database`, `shared-types`, `shared-utils`, `config`).

## Multi-tenant: row-level con `companyId`

Se eligió aislamiento **row-level** (columna `companyId` en cada tabla de negocio) en lugar de
schema-per-tenant, porque el objetivo es soportar **miles de negocios pequeños/medianos**:

- Una sola migración de Prisma aplica para todos los tenants (schema-per-tenant requeriría aplicarla
  N veces).
- Un solo pool de conexiones (compatible con pgBouncer); schema-per-tenant escala mal en conexiones.
- `@@index([companyId, ...])` mantiene las queries rápidas sin la complejidad operativa de miles de
  schemas.
- Si en el futuro un cliente enterprise necesita aislamiento físico total, se migra ese tenant puntual
  a una base de datos separada (excepción, no el diseño por defecto).

Mitigación del riesgo de "olvidar el filtro `companyId`": un **Prisma Client Extension**
(`apps/api/src/shared/prisma/tenant.extension.ts`) inyecta automáticamente `companyId` en
`findMany/findFirst/count/updateMany/deleteMany/create` a partir del contexto de la request
(`AsyncLocalStorage`, ver `apps/api/src/shared/context/request-context.ts`).

**Convención obligatoria**: `update`/`delete`/`findUnique` por `id` **no** quedan cubiertos
automáticamente (Prisma no permite mutar el `where` de `findUnique` con campos extra). Todo repositorio
Prisma debe primero hacer `findFirst({ where: { id, companyId } })` para confirmar pertenencia al tenant
antes de `update`/`delete`. Ver `apps/api/src/shared/prisma/README.md`.

Hardening de fase 2 (no implementado aún): Postgres Row-Level Security como cinturón de seguridad
adicional para accesos directos a la base de datos.

## Patrón de módulo (Clean Architecture)

Cada módulo de negocio vive en `apps/api/src/modules/<módulo>/` con 4 capas:

```
modules/inventory/product/
├── domain/            # Entidades y puertos (interfaces), sin dependencias de Prisma/Express
├── application/        # Casos de uso (use-cases) y DTOs, dependen solo de domain/
├── infrastructure/     # Implementación de los puertos con Prisma
└── interfaces/          # Capa HTTP: controller, routes, validators (zod), mapper
```

- `domain/` y `application/` no importan `@prisma/client` ni `express`.
- Composición manual (sin DI framework pesado): cada módulo expone un `<module>.container.ts` que
  construye `repository → use-cases → controller` y se registra en `apps/api/src/app.ts`.
- Los módulos **stub** siguen la misma estructura pero solo tienen `domain/` mínimo + rutas que
  responden `501` + un `README.md` documentando el alcance planeado.

## RBAC y seguridad de productos

- Roles de sistema: Administrador, Propietario, Contador, Supervisor, Cajero, Empleado.
- Permisos granulares (`Permission.code`, ej. `product.price.update`, `product.delete`,
  `discount.authorize`) asignados por rol (`RolePermission`) con posibilidad de override individual
  (`UserPermission.granted = true|false`).
- Cajeros **no** tienen por defecto `product.price.update`, `product.cost.update`,
  `product.barcode.update` ni `product.delete` — se validan con `requirePermission(...)` en las rutas.

## Autorización de descuentos

`CashierDiscountLimit.maxDiscountPercent` define el % máximo por cajero. Si una venta intenta aplicar
un descuento mayor, `CreateSaleUseCase` la deja en estado `PENDING_AUTHORIZATION` (no se completa). El
endpoint `POST /sales/:id/authorize-discount` valida las credenciales (PIN o usuario/contraseña) de un
autorizador con permiso `discount.authorize`, crea un registro `DiscountAuthorization` (quién autorizó,
quién vendió, producto, descuento, motivo, fecha/hora) y un `AuditLog`, y solo entonces la venta pasa a
`COMPLETED`.

## Auditoría inmutable

`AuditLog` solo expone `create` y lecturas en su repositorio — nunca `update`/`delete` — como refuerzo
a nivel de código de la regla "los registros no podrán eliminarse". El servicio compartido
`AuditService` (`apps/api/src/modules/audit/application/audit.service.ts`) es usado por todos los demás
módulos funcionales.

## Frontend

- `apps/web`: Vite + React + TS + Tailwind, TanStack Query para data-fetching, Zustand para el estado
  de sesión (usuario, empresa, sucursal activa, permisos), rutas protegidas por permiso.
- `apps/mobile`: Expo, comparte tipos con `packages/shared-types`, `expo-sqlite` como base para el
  futuro modo offline.

## Paquetes compartidos

- `packages/shared-types`: enums y esquemas zod de request/response, usados por `api` (parseo/DTOs) y
  por `web`/`mobile` (tipado de llamadas y formularios) — evita que el contrato FE/BE diverja.
- `packages/shared-utils`: formato de moneda COP, fechas en zona horaria `America/Bogota`, validación
  de NIT/cédula, cálculo de IVA — funciones puras usadas por los tres apps.
