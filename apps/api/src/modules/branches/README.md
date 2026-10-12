# Sucursales (`modules/branches`)

Item 50 de `docs/ALCANCE.md` (2026-10-12): una empresa puede operar varias sedes con su propia caja,
sus propios cajeros y sus propios informes. Antes las sucursales solo servian para el inventario:
todo usuario quedaba amarrado a la principal y las sucursales nuevas no tenian caja.

## Implementado

1. **Crear** (`POST /branches`, `branch.manage`): respeta `Plan.maxBranches` y crea la caja de la
   sucursal ("Caja <nombre>", codigo `CAJA1`) en la misma transaccion. La migracion
   `20261012160000_backfill_branch_cash_registers` le dio caja a las sucursales que ya existian sin
   una.
2. **Editar, desactivar y reactivar** (`PATCH /branches/:id`, `UpdateBranchUseCase`). La principal no
   se desactiva; tampoco una con la caja abierta, ni la sucursal en la que esta trabajando quien
   hace el cambio. Al desactivar, sus usuarios pierden esa sucursal y el que se queda sin ninguna
   (o la tenia por defecto) pasa a la principal; su caja queda inactiva. Reactivar cuenta contra el
   limite del plan. `GET /branches?includeInactive=true` lista tambien las desactivadas.
3. **Usuarios por sucursal** (modulo `rbac`): `PUT /users/:userId/branches` (`SetUserBranchesUseCase`,
   `rbac.manage`) reemplaza las sucursales del usuario y marca la principal (`UserBranch.isDefault`).
   `POST /users` acepta `branchId` para crear al usuario directo en una sucursal. `GET /users`
   devuelve las sucursales de cada uno.
4. **Cambiar de sucursal** (modulo `auth`): `GET /auth/branches` lista a cuales puede entrar el
   usuario (las asignadas, o todas si tiene `branch.manage`) y `POST /auth/switch-branch`
   (`SwitchBranchUseCase`) la deja como su sucursal por defecto y devuelve un access token nuevo con
   ese `branchId`. Como el refresh y el login leen la sucursal por defecto, el cambio se mantiene
   al renovar el token y al volver a entrar. Ventas, caja (`GET /cash/registers` filtra por la
   sucursal del token) y compras salen de la sucursal activa.
5. **Informes por sucursal** (modulo `accounting`): Balance General, Estado de Resultados y Libro
   mayor aceptan `?branchId=` (filtra `JournalEntry.branchId`); sin el, toda la empresa.
6. **UI**: selector de sucursal en la barra superior (`components/ui/BranchSwitcher.tsx`, recarga la
   pagina al cambiar); tarjeta "Sucursales de cada usuario" en Roles y permisos; tabla de
   sucursales con editar/desactivar en Inventario -> Sucursales; filtro "Todas las sucursales" en
   Contabilidad -> Reportes; la pantalla de Caja muestra el nombre de la caja.

Verificado en vivo contra Postgres local: crear sucursal con caja, cajero creado en la sucursal
nueva que entra en ella, abre caja, vende y cierra; el informe de esa sucursal muestra solo esa
venta; cambio de sucursal (rechazado si no esta asignado, conservado en refresh y nuevo login);
desactivar bloqueado con caja abierta y en la sucursal activa; usuarios reasignados a la principal.

## Limitaciones

- El Flujo de caja no filtra por sucursal (sale de `CashMovement`/`BankTransaction`).
- Los comprobantes manuales quedan en la sucursal activa de quien los crea.
- `POST /sales` sigue tomando `branchId` del body sin verificar que el usuario este asignado a esa
  sucursal (la web manda la sucursal activa; la API publica y la sincronizacion movil lo usan).
- Desactivar no mueve el inventario de la sucursal: hay que trasladarlo antes.
