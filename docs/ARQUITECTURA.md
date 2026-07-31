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

**Única excepción deliberada**: el panel administrador SaaS (`apps/api/src/modules/saas-admin`) es
transversal a todas las empresas por diseño (gestiona planes/suscripciones/cobro de la plataforma
misma, no de una empresa cliente), así que no corre bajo `tenantContextMiddleware` ni
`AsyncLocalStorage`: usa `basePrisma` directo (sin la extensión de aislamiento) y filtra por
`companyId` explícito solo donde aplica, con un JWT firmado con un secreto **separado**
(`JWT_PLATFORM_ADMIN_SECRET`) del de usuarios de empresa — un token de plataforma nunca puede
reusarse como token de empresa ni viceversa. Ver `apps/api/src/modules/saas-admin/README.md`.
También importa el orden de montaje de routers en `app.ts`: `saasAdminRouter` va ANTES que
cualquier router tenant-scoped, porque `tenantContextMiddleware` intercepta cualquier request que
le llegue (no solo sus propias rutas) y responde 401 antes de que Express siga probando routers
posteriores.

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
- Ya no quedan módulos **stub** (schema completo sin lógica de negocio, rutas `501`) — el último,
  sincronización offline, se implementó en la iteración 18. Si se agrega uno nuevo, sigue la misma
  estructura reducida (`domain/` mínimo + rutas `501` + `README.md` con el alcance planeado).

### Reuso de casos de uso entre módulos

Para que un módulo use un caso de uso de otro (ej. `suppliers` necesita anular un comprobante
contable, `sync` necesita crear una venta) **nunca se duplica la lógica**: el módulo dueño exporta
la instancia ya compuesta desde su propio `container.ts`, y el módulo consumidor la importa. Un
repositorio Prisma sin estado propio se puede instanciar dos veces sin problema si evita un ciclo
de imports entre containers (ej. `accounting.container.ts` y `cash-session.container.ts` se
importarían en círculo, así que cada uno instancia su propio `PrismaCashSessionRepository`).
Ejemplos: `postSaleJournalEntryUseCase`/`voidJournalEntryUseCase` (`accounting.container.ts`,
consumidos por `pos/sale` y `suppliers`), `createSaleUseCase` (`sale.container.ts`, consumido por
`sync` para reproducir ventas encoladas offline).

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

## Integraciones externas sin credenciales de producción

Patrón usado dos veces (DIAN y Resend, para facturación electrónica y recordatorios de suscripción
respectivamente) y pensado para repetirse: cuando una integración externa real no se puede probar
en este entorno por falta de credenciales de producción, se implementa **completa** igual —
`fetch` directo en vez de un SDK/paquete pesado (más fácil de inspeccionar y ajustar sin pelear
con una capa de generación automática, ver `dian-soap-client.ts`/`resend-email-notifier.ts`) — en
vez de dejarla a medias o mockeada. Las variables de entorno correspondientes son opcionales con
default `""` (`config/env.ts`), y el código falla con un `Error` de mensaje claro cuando faltan, no
con un crash silencioso ni un mock que finge que funcionó. El caller (poller o caso de uso)
**nunca** reporta éxito sin haber llamado de verdad al servicio externo — si la llamada falla o
está deshabilitada por falta de config, el estado queda pendiente para reintentar, no se marca
como completado. Documentado explícitamente en el README de cada módulo como "no verificado contra
el servicio real" cuando aplica.

## Sincronización offline (patrón outbox)

`apps/api/src/modules/sync` implementa el lado servidor de sincronización offline para la app
móvil (`apps/mobile/src/lib/local-db` + `lib/sync`), hoy acotado a ventas:

- **Idempotencia por `clientEventId`** (generado por el cliente al encolar el evento localmente,
  no por el servidor): reenviar el mismo evento (ej. la respuesta se perdió por la red) devuelve
  el mismo resultado sin duplicar la operación. La comparación de payload para detectar reintentos
  vs. conflictos reales usa una función que ordena las claves recursivamente antes de comparar
  (`stableStringify`), **no** `JSON.stringify` plano — Postgres JSONB no preserva el orden de
  inserción de las claves, así que comparar el payload recién llegado contra el que se releyó de
  la base con `JSON.stringify` normal da falsos positivos de conflicto. Vale la pena recordar este
  detalle para cualquier otra comparación de JSON persistido en Postgres.
- Cada evento se aplica reusando el MISMO caso de uso que su endpoint REST equivalente (ver
  "Reuso de casos de uso entre módulos" arriba) — nunca se reimplementa la lógica de negocio para
  la variante "offline" de una operación.
- Conflictos reales (mismo `clientEventId`, payload distinto) se registran en `SyncConflictLog` en
  vez de reprocesarse a ciegas.
- Sin dependencias nativas nuevas del lado móvil (ej. `@react-native-community/netinfo`) cuando no
  se pueden verificar en el entorno de desarrollo (sin emulador/dispositivo) — se prefiere un
  intervalo simple con el mismo resultado práctico antes que una dependencia nativa sin probar.

## Frontend

- `apps/web`: Vite + React + TS + Tailwind, TanStack Query para data-fetching, Zustand para el estado
  de sesión (usuario, empresa, sucursal activa, permisos), rutas protegidas por permiso.
- `apps/mobile`: Expo, comparte tipos con `packages/shared-types`. POS con sincronización offline
  real (ver sección anterior): `expo-sqlite` cachea el catálogo de productos (lectura, la UI
  siempre lee de ahí, no directo de la API) y encola ventas hechas sin conexión.

## Paquetes compartidos

- `packages/shared-types`: enums y esquemas zod de request/response, usados por `api` (parseo/DTOs) y
  por `web`/`mobile` (tipado de llamadas y formularios) — evita que el contrato FE/BE diverja.
- `packages/shared-utils`: formato de moneda COP, fechas en zona horaria `America/Bogota`, validación
  de NIT/cédula, cálculo de IVA — funciones puras usadas por los tres apps.
