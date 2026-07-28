# Modulo: Empleados

Estado: **funcional** (CRUD completo). Ver `docs/ALCANCE.md` para el estado general del proyecto.

## Endpoints

- `GET /employees?branchId=&status=` — listar (permiso `employee.read`).
- `GET /employees/:id` — detalle (permiso `employee.read`).
- `POST /employees` — crear (permiso `employee.create`). Valida cedula colombiana con
  `isValidCedula` (`@erp/shared-utils`) cuando `documentType === "CC"`.
- `PATCH /employees/:id` — actualizar datos (permiso `employee.update`).
- `POST /employees/:id/deactivate` — dar de baja (`status: INACTIVE` + `terminationDate`, NO
  borra el registro) (permiso `employee.deactivate`).

Todas las mutaciones quedan auditadas (`EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`,
`EMPLOYEE_DEACTIVATED`).

## Uso desde otros modulos

- `modules/timetracking`: usa `IEmployeeRepository.findByIdOrThrow` / `findByUserId` para
  resolver la sucursal del empleado y validar que un usuario solo marque su propia entrada/salida.
- `modules/payroll`: usa `IEmployeeRepository.listActiveForPeriod` para saber que empleados
  liquidar en un periodo (considera `hireDate`/`terminationDate`).

## Pendiente (no implementado en esta iteracion)

- Vinculacion explicita de un `Employee` existente a un `User` recien creado desde la UI (hoy
  `Employee.userId` se puede setear a mano en la base, pero no hay endpoint dedicado).
- Reportes/exportables de nomina de personal.
