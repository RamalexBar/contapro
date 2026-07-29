# Modulo: Control de Horarios

Estado: **funcional**. Marcacion de entrada/salida y vacaciones/permisos/ausencias/incapacidades
estan implementados.

## Endpoints funcionales

### Marcacion de entrada/salida

- `POST /time-entries/clock-in` — marca entrada (`employeeId`, `clockIn?` por defecto ahora,
  `source`, `notes`). Permiso `timetracking.clock`.
- `POST /time-entries/:id/clock-out` — marca salida de una entrada abierta. Permiso
  `timetracking.clock`.
- `GET /time-entries?employeeId=&from=&to=` — listar. Permiso `timetracking.read`.
- `GET /time-entries/my-open` — entrada abierta del empleado vinculado al usuario autenticado
  (self-service, ver abajo). Permiso `timetracking.clock`.
- `GET /employees/me` (modulo `employees`) — empleado vinculado al usuario autenticado, sin
  requerir `employee.read`. Necesario para que un Cajero/Empleado con solo `timetracking.clock`
  pueda resolver su propio `employeeId` y consultar si tiene una entrada abierta antes de marcar
  salida.

Un usuario que **solo** tiene `timetracking.clock` (Cajero/Empleado por defecto) unicamente puede
marcar su propia entrada/salida, resuelta via `Employee.userId`. Quien tiene
`timetracking.manage` (Supervisor/Administrador/Propietario) puede marcar por cualquier empleado.

`TimeEntry` no tiene columna `companyId` (ver `timetracking.prisma`): el aislamiento multi-tenant
se hace a mano en `PrismaTimeTrackingRepository` filtrando por la relacion `employee.companyId`
en cada consulta (no queda cubierto por la extension automatica de `tenant.extension.ts`).

### Vacaciones, permisos, ausencias e incapacidades

- `GET/POST /vacations`, `POST /vacations/:id/approve`, `POST /vacations/:id/reject` — flujo
  `REQUESTED` → `APPROVED`/`REJECTED`.
- `GET/POST /leave-permissions`, `POST /leave-permissions/:id/approve`,
  `POST /leave-permissions/:id/reject` — mismo flujo, con `type` (PERSONAL/PATERNITY/MATERNITY/
  BEREAVEMENT/OTHER) y `paid`.
- `GET/POST /sick-leaves`, `POST /sick-leaves/:id/approve`, `POST /sick-leaves/:id/reject` — flujo
  `SUBMITTED` → `APPROVED`/`REJECTED`, con `type` (GENERAL/LABOR_ARL/MATERNITY).
- `GET/POST /absences` — sin flujo de aprobacion: un supervisor registra directamente si la
  ausencia fue justificada o no (`timeoff.manage`).

Permisos: `timeoff.request` (solicitar/radicar las propias, igual regla de auto-servicio que
`timetracking.clock`), `timeoff.manage` (aprobar/rechazar y registrar ausencias de cualquier
empleado), `timeoff.read` (consultar). Logica en `domain/time-off.repository.ts`,
`infrastructure/prisma-time-off.repository.ts` y `application/use-cases/*-time-off.use-case.ts`
(`approve`/`reject` son genericos, parametrizados por `kind: "vacation" | "leave-permission" |
"sick-leave"`, ya que las tres entidades comparten el mismo flujo de aprobacion).

`Vacation`/`LeavePermission`/`Absence`/`SickLeave` tampoco tienen `companyId` — mismo patron de
aislamiento manual via `employee.companyId` que `TimeEntry`.

## Limitaciones conocidas del calculo de horas para Nomina (`modules/payroll`)

- Cada `TimeEntry` se clasifica como diurna/nocturna **en bloque** segun la hora de inicio; una
  marcacion que cruza la franja diurna/nocturna no se divide.
- Las horas que exceden 8 en una misma marcacion se tratan como extra; si un empleado tiene
  varias marcaciones el mismo dia, no se acumulan entre si.
- El recargo dominical/festivo solo detecta **domingo** — no hay calendario de festivos
  colombianos (son moviles, requieren mantenimiento anual).

Ver `apps/api/src/modules/payroll/application/payroll-calculator.ts` para el detalle.

## Que sigue sin implementar

- Calendario de festivos colombianos (afecta el recargo dominical/festivo de nomina, ver arriba).
- Reportes por empleado/sucursal/periodo.
- `Vacation.daysTaken` lo indica quien solicita (no se calcula automaticamente contra un
  calendario de dias habiles/festivos).
