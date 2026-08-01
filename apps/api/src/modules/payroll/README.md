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
- `GET /payslips/:id/pdf` — el mismo desprendible en PDF (ver "PDF del desprendible" mas abajo).
  Permiso `payroll.read`.
- `POST /payroll-deductions`, `GET /payroll-deductions`, `POST /payroll-deductions/:id/cancel` —
  libranzas/embargos recurrentes (ver "Deducciones recurrentes" mas abajo). Permiso
  `payroll.deduction.manage` (crear/cancelar) / `payroll.read` (listar).

## Motor de liquidacion (`application/payroll-calculator.ts` + `calculate-payroll.use-case.ts`)

Por cada `Employee` activo en la sucursal/periodo (`IEmployeeRepository.listActiveForPeriod`):

1. **Prorrateo**: mes comercial de 30 dias, prorrateado por `hireDate`/`terminationDate` si caen
   dentro del periodo (`daysWorkedInPeriod`).
2. **Devengados**: `SALARY` (prorateado), `TRANSPORT_ALLOWANCE` (solo si `baseSalary <= 2 x
   minimumWage`), y horas extra/recargos derivados de `TimeEntry` (`OVERTIME_DAY`,
   `OVERTIME_NIGHT`, `NIGHT_SURCHARGE`, `SUNDAY_SURCHARGE` — este ultimo aplica a domingo Y a
   festivo colombiano, ver `@erp/shared-utils/colombian-holidays.ts`) — ver las limitaciones de
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

## PDF del desprendible (iteracion 14)

`GET /payslips/:id/pdf` genera el PDF del desprendible de pago (documento interno para el
empleado) al vuelo desde `PayslipDocument.summaryJson` + `Employee` + `Company` — no se persiste
en storage (`PayslipDocument.fileUrl` sigue sin usarse, mismo patron que el RIDE de facturacion
electronica: se regenera en cada request en vez de cachearse). Ver
`application/payslip-data-mapper.ts` y `infrastructure/pdfkit-payslip-renderer.ts`.

**No confundir con el RIDE de nomina electronica DIAN** (`GET
/electronic-invoicing/payroll-details/:payrollDetailId/pdf`, ver
`modules/electronic-invoicing/README.md`): ese es el comprobante fiscal ante la DIAN (requiere que
la nomina se haya enviado electronicamente), este es el comprobante que recibe el empleado y
existe para cualquier periodo calculado, sin depender de facturacion electronica.

## Deducciones recurrentes: libranzas y embargos (iteracion 19)

`PayrollDeduction` (`domain/payroll-deduction.repository.ts`,
`infrastructure/prisma-payroll-deduction.repository.ts`) registra una deduccion recurrente por
empleado (`type`: `LOAN_DEDUCTION` libranza o `GARNISHMENT` embargo) con una cuota fija
(`amountPerPeriod`) que se aplica automaticamente en **cada** periodo mientras este `ACTIVE`.
`totalAmount`/`remainingBalance` son opcionales: si se dan, la deduccion se agota sola (pasa a
`COMPLETED` cuando el saldo llega a 0); si no, es indefinida hasta que alguien la cancele con
`POST /payroll-deductions/:id/cancel` (tipico de un embargo sin monto total conocido de antemano).

**Importante — esto NO calcula ningun tope legal de embargabilidad.** `amountPerPeriod` es la
cuota ya definida externamente (el credito o el auto judicial); el sistema no conoce ni aplica las
reglas del CST sobre que porcentaje del salario es embargable. Lo unico que hace
`payroll-calculator.ts` es una **salvaguarda de integridad de datos**: si la suma de deducciones
adicionales activas superaria el `netPay` del periodo (antes de estas deducciones), se recortan en
orden hasta que `netPay` llegue a 0 (nunca negativo) — no es un limite legal, es solo para que la
liquidacion no produzca un pago neto negativo.

Igual que con la nomina electronica, la aplicacion real de una deduccion (decrementar
`remainingBalance`, marcar `COMPLETED` al llegar a 0) ocurre en **aprobar** (`approve-payroll.use-
case.ts`), no en calcular: calcular es idempotente/re-ejecutable (recalcular una nomina `CALCULATED`
vuelve a mostrar la cuota completa sin gastar saldo), aprobar es el punto sin retorno donde ya se
generaron los asientos contables y (si aplica) la nomina electronica DIAN.

Las lineas de `LOAN_DEDUCTION`/`GARNISHMENT` aplicadas aparecen tambien en el desprendible en PDF
del empleado (`summaryJson.deducciones.adicionales`, ver `payslip-data-mapper.ts`).

## Que sigue sin implementar

1. **Reportes** mensual/anual consolidados.

(La integracion contable al aprobar una nomina, item pendiente historicamente en esta lista, ya
esta implementada — ver `approve-payroll.use-case.ts` y `modules/accounting`.)
