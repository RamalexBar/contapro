# Modulo: Control de Horarios

Estado: **parcialmente funcional**. Marcacion de entrada/salida (lo que necesita Nomina para
calcular horas extra/recargos) esta implementado. Vacaciones/permisos/ausencias/incapacidades
siguen siendo stub (`501`).

## Endpoints funcionales

- `POST /time-entries/clock-in` — marca entrada (`employeeId`, `clockIn?` por defecto ahora,
  `source`, `notes`). Permiso `timetracking.clock`.
- `POST /time-entries/:id/clock-out` — marca salida de una entrada abierta. Permiso
  `timetracking.clock`.
- `GET /time-entries?employeeId=&from=&to=` — listar. Permiso `timetracking.read`.

Un usuario que **solo** tiene `timetracking.clock` (Cajero/Empleado por defecto) unicamente puede
marcar su propia entrada/salida, resuelta via `Employee.userId`. Quien tiene
`timetracking.manage` (Supervisor/Administrador/Propietario) puede marcar por cualquier empleado.

`TimeEntry` no tiene columna `companyId` (ver `timetracking.prisma`): el aislamiento multi-tenant
se hace a mano en `PrismaTimeTrackingRepository` filtrando por la relacion `employee.companyId`
en cada consulta (no queda cubierto por la extension automatica de `tenant.extension.ts`).

## Limitaciones conocidas del calculo de horas para Nomina (`modules/payroll`)

- Cada `TimeEntry` se clasifica como diurna/nocturna **en bloque** segun la hora de inicio; una
  marcacion que cruza la franja diurna/nocturna no se divide.
- Las horas que exceden 8 en una misma marcacion se tratan como extra; si un empleado tiene
  varias marcaciones el mismo dia, no se acumulan entre si.
- El recargo dominical/festivo solo detecta **domingo** — no hay calendario de festivos
  colombianos (son moviles, requieren mantenimiento anual).

Ver `apps/api/src/modules/payroll/application/payroll-calculator.ts` para el detalle.

## Que sigue sin implementar

- `POST /vacations`, `/leave-permissions`, `/absences`, `/sick-leaves` (modelos ya listos en
  `timetracking.prisma`, flujo de aprobacion REQUESTED -> APPROVED/REJECTED pendiente).
- Reportes por empleado/sucursal/periodo.
