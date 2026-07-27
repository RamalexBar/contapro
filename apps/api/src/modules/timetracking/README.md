# Modulo: Control de Horarios (STUB)

Estado: **modelo de datos completo en Prisma, sin logica de negocio implementada.**

## Modelos ya disponibles (`packages/database/prisma/schema/timetracking.prisma`)

- `TimeEntry` — entrada/salida (`clockIn`/`clockOut`), origen (manual/biometrico/app).
- `Vacation` — solicitud y aprobacion de vacaciones.
- `LeavePermission` — permisos (personal, paternidad, maternidad, luto, otro).
- `Absence` — ausencias justificadas/injustificadas.
- `SickLeave` — incapacidades (general, laboral/ARL, maternidad).

## Que falta implementar

1. Registro de entrada/salida (`POST /time-entries/clock-in`, `/clock-out`) por empleado.
2. Calculo de horas laboradas/extras/nocturnas/dominicales/festivas por periodo, usando los
   porcentajes definidos en `PayrollParameter` (`modules/payroll`), para alimentar la nomina.
3. Flujo de aprobacion de vacaciones/permisos/incapacidades (estados REQUESTED -> APPROVED/REJECTED).
4. Reportes por empleado/sucursal/periodo (horas trabajadas, ausentismo, etc.).
5. Integracion con `modules/payroll`: los conceptos de horas extra/recargos de la nomina de un
   periodo deben poder derivarse automaticamente de `TimeEntry` en vez de digitarse a mano.

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/timetracking.routes.ts`).
