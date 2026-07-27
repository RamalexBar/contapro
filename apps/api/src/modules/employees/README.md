# Modulo: Empleados (STUB)

Estado: **modelo de datos completo en Prisma, sin logica de negocio implementada.**

## Modelo ya disponible (`packages/database/prisma/schema/employees.prisma`)

`Employee`: datos personales, documento, cargo, tipo de contrato, salario base, fecha de
ingreso/retiro, estado, EPS/ARL/fondo de pension/caja de compensacion (necesarios para nomina),
y vinculo opcional a `User` (si el empleado tambien es usuario del sistema).

## Que falta implementar

1. CRUD de empleados (`domain/employee.repository.ts`, casos de uso, controller/routes).
2. Validaciones colombianas: documento (cedula/CE), rango de `arlRiskLevel` (I-V).
3. Vinculacion opcional con `User` + `Role` (ej. un cajero que ademas es un `Employee`).
4. Relacion con `modules/timetracking` (control de horarios) y `modules/payroll` (nomina),
   que ya referencian `Employee` en sus modelos Prisma.
5. Auditoria de creacion/edicion/retiro de empleados.

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/employees.routes.ts`).
