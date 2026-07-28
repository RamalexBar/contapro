# Modulo: Nomina Colombia

Estado: **funcional** (motor de liquidacion real). Ver `docs/ALCANCE.md` para el estado general.

> **IMPORTANTE**: los porcentajes/valores de `PayrollParameter` sembrados por el seed
> (`packages/database/prisma/seed.ts`) son de **EJEMPLO** para poder probar el flujo end-to-end.
> NO son cifras oficiales del DIAN/Mintrabajo. Verifica los valores reales del año a liquidar
> antes de usar esto en produccion.

## Modelos (`packages/database/prisma/schema/payroll.prisma`)

`PayrollParameter` es una tabla **global** (sin `companyId`): la legislacion laboral colombiana es
la misma para todas las empresas del SaaS, asi que una fila nueva por año la ven todas las
empresas — no hace falta tocar codigo para actualizar la legislacion de un año nuevo.

## Endpoints

- `POST /payroll-parameters`, `GET /payroll-parameters` — permiso `payroll.parameter.manage`
  (Administrador/Propietario/Contador).
- `POST /payrolls` — crea un periodo `DRAFT` (`year`, `month`, `periodType`, `startDate`,
  `endDate`, `branchId?`). Permiso `payroll.create`.
- `GET /payrolls`, `GET /payrolls/:id` — listar / detalle con `PayrollDetail` + `PayrollItem` +
  `PayslipDocument` por empleado. Permiso `payroll.read`.
- `POST /payrolls/:id/calculate` — corre el motor de liquidacion (desde `DRAFT` o para
  recalcular desde `CALCULATED`), deja el periodo en `CALCULATED`. Permiso `payroll.calculate`.
- `POST /payrolls/:id/approve` — `CALCULATED` -> `APPROVED`. Permiso `payroll.approve`.
- `POST /payrolls/:id/pay` — `APPROVED` -> `PAID`. Permiso `payroll.pay`.
- `GET /payslips/:id` — desprendible individual (JSON, ver mas abajo). Permiso `payroll.read`.

## Motor de liquidacion (`application/payroll-calculator.ts` + `calculate-payroll.use-case.ts`)

Por cada `Employee` activo en la sucursal/periodo (`IEmployeeRepository.listActiveForPeriod`):

1. **Prorrateo**: mes comercial de 30 dias, prorrateado por `hireDate`/`terminationDate` si caen
   dentro del periodo (`daysWorkedInPeriod`).
2. **Devengados**: `SALARY` (prorateado), `TRANSPORT_ALLOWANCE` (solo si `baseSalary <= 2 x
   minimumWage`), y horas extra/recargos derivados de `TimeEntry` (`OVERTIME_DAY`,
   `OVERTIME_NIGHT`, `NIGHT_SURCHARGE`, `SUNDAY_SURCHARGE`) — ver las limitaciones de
   clasificacion de horas en `modules/timetracking/README.md`.
3. **Deducciones** (`HEALTH_EMPLOYEE`, `PENSION_EMPLOYEE`) sobre la base salarial (sin auxilio de
   transporte, que no es constitutivo de salario).
4. **Aportes patronales** (`HEALTH_EMPLOYER`, `PENSION_EMPLOYER`, `ARL` segun
   `Employee.arlRiskLevel`, `CCF`, `ICBF`, `SENA`) y **provisiones** (`SEVERANCE`,
   `SEVERANCE_INTEREST`, `SERVICE_BONUS`, `VACATION`) — no afectan `netPay`, solo
   `employerCostTotal`.
5. Persiste `PayrollDetail` + `PayrollItem[]` + `PayslipDocument` (JSON resumen) en una sola
   transaccion Prisma (`PrismaPayrollRepository.saveCalculationResults`), borrando el detalle
   previo si es un recalculo.

`PayslipDocument`/`TimeEntry` no tienen `companyId` en el modelo Prisma; el aislamiento
multi-tenant de esas consultas se hace a mano via la relacion (`payrollDetail.payroll.companyId` /
`employee.companyId`) en los repositorios de infraestructura — ver comentarios en
`prisma-payroll.repository.ts` y `prisma-timetracking.repository.ts`.

## Que sigue sin implementar

1. **PDF del desprendible** — `PayslipDocument.fileUrl` existe mas no se genera; hoy solo
   `summaryJson`.
2. **Integracion contable**: al aprobar una nomina, generar el `JournalEntry` correspondiente
   (gasto de nomina, pasivos laborales, retenciones) — `modules/accounting` es 100% stub, se
   implementa cuando se aborde ese modulo.
3. **Calendario de festivos colombianos** para el recargo dominical/festivo (hoy solo domingo).
4. **Deducciones detalladas** (libranzas/embargos) — hoy no hay conceptos automaticos para esto.
5. **Reportes** mensual/anual consolidados.
