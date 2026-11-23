# Modulo: Nomina Colombia

Estado: **funcional** (motor de liquidacion real). Ver `docs/ALCANCE.md` para el estado general.

> **Valores 2026 oficiales** (verificados 2026-11-23, cargados por la migracion
> `20261123120000_payroll_legal_2026` y por el seed): salario minimo $1.750.905, auxilio de
> transporte $249.095 (Decretos 1469 y 1470 de 2025, ratificados por el Decreto 0159 de 2026), UVT
> $52.374 (Resolucion DIAN 000238 de 2025). Cada año nuevo hay que crear su fila de parametros.

## Nomina quincenal

En Colombia se paga normalmente el 15 y el ultimo dia del mes. Al crear el periodo se elige "1a quincena"
(1-15), "2a quincena" (16 al ultimo dia: 28, 29, 30 o 31) o "Mes completo", y las fechas se llenan solas.
Los dias se cuentan en año comercial (`days360`): cada quincena vale 15 dias y cada mes 30 (tambien
febrero). Pueden existir dos periodos BIWEEKLY en el mismo mes (`startDate` en la llave unica). La
retencion de una quincena se calcula sobre el equivalente mensual y se toma la mitad. El desprendible
lleva el nombre del empleado, el periodo ("Segunda quincena de septiembre de 2026"), las fechas desde y
hasta y la fecha de pago.

## Reglas legales que aplica el motor (ajuste 2026-11-23)

| Regla | Norma | Donde |
|---|---|---|
| IBC de salud/pension/ARL/FSP entre 1 y 25 SMMLV (proporcional a los dias) | Ley 100/1993 art. 18, Ley 797/2003 art. 5 | `payroll-calculator.ts` |
| Fondo de Solidaridad Pensional 1% desde 4 SMMLV, hasta 2% desde 20 SMMLV | Ley 100/1993 art. 27, Ley 797/2003 art. 8 | `solidarityFundPercent` |
| Retencion en la fuente por salarios, procedimiento 1: aportes como no gravados, renta exenta 25% (tope 790 UVT/año), tope conjunto 40% / 1.340 UVT, tabla art. 383, redondeo a miles | E.T. arts. 206-10, 336, 383, 385, 868 | `salaryWithholdingTax` |
| Exoneracion de salud empleador, SENA e ICBF por trabajadores de menos de 10 SMMLV (lo marca la empresa en Nomina -> Configuracion; por defecto NO) | E.T. art. 114-1 | `PayrollCompanyOptions`, `Company.payrollExemptArt1141` |
| Parafiscales (caja, ICBF, SENA) sobre la nomina de salarios, sin tope de 25 SMMLV | Ley 21/1982 | `payroll-calculator.ts` |
| Cesantias y prima sobre salario + auxilio de transporte; vacaciones solo salario | Ley 1/1963 art. 7 | `benefitsBase` |
| Intereses de cesantias: provision del 12% de las cesantias del mes | Ley 52/1975 | `severanceInterest` |
| Trabajo nocturno desde las 7 p. m. a partir del 2025-12-25 (antes 9 p. m.) | Ley 2466/2025 | `NIGHT_FROM_7PM_SINCE` |
| Recargo dominical/festivo 80% (jul 2025), 90% (jul 2026), 100% (jul 2027) sobre toda hora de domingo/festivo (tambien las extra); se usa el mayor entre esto y el parametro | Ley 2466/2025 | `legalSundaySurchargePercent` |
| Jornada de 44 h (jul 2025) y 42 h (15 jul 2026): divisor 220 / 210; se usa el menor entre esto y el parametro | Ley 2101/2021 | `legalMonthlyHoursDivisor` |

Contabilidad: la retencion en la fuente va a su propia cuenta **236505** (se declara en el
formulario 350); salud, pension, FSP y libranzas siguen en 2370. Nomina electronica DIAN: el FSP sale
como `FondoSP` y la retencion en `RetencionFuente` (antes iba siempre en 0).

**Agregado el mismo dia (segunda pasada):**
- Parametros legales SOLO desde el panel de plataforma (`/admin/payroll-parameters`, pagina "Nomina" del
  panel). Antes `POST /payroll-parameters` lo podia usar el administrador o contador de cualquier
  empresa y los valores aplicaban a todas; ahora las empresas solo los leen (`payroll.read`).
- Retencion con soportes del trabajador (Empleados -> Editar): dependientes (10%, tope 32 UVT), intereses
  de vivienda (tope 100 UVT), medicina prepagada (tope 16 UVT), aportes voluntarios/AFC (30% y 3.800
  UVT/año), todo dentro del tope conjunto 40% / 1.340 UVT.
- Salario integral (`Employee.salaryType = INTEGRAL`): minimo 13 SMMLV (se valida al calcular),
  aportes y parafiscales sobre el 70%, sin auxilio, cesantias, intereses ni prima.
- Horas trabajadas clasificadas minuto a minuto: una marcacion que cruza las 7 p. m. se divide en
  diurna y nocturna; las marcaciones del mismo dia se suman antes de contar extras; la hora extra en
  domingo/festivo lleva tambien el recargo dominical.

## Pago de prestaciones sociales (Nomina -> Prestaciones sociales)

La nomina mensual solo PROVISIONA cesantias, intereses, prima y vacaciones. Su pago se hace aqui
(`benefit-settlement-calculator.ts`, `SettleBenefitsUseCase`, tabla `BenefitSettlement`):

| Operacion | Que calcula | Contabilidad |
|---|---|---|
| Prima de servicios (semestre 1 o 2) | (salario + auxilio + promedio de extras/recargos) x dias del semestre / 360 (art. 306 CST) | Dr 2610 (provision) / Cr 2505 |
| Consolidacion anual de cesantias | Cesantias (art. 249) al fondo + intereses 12% (Ley 52/1975) al trabajador | Dr 2610 / Cr 2510 (fondo) y 2505 |
| Liquidacion de contrato (al dar de baja) | Cesantias e intereses del año, prima del semestre (si no se pago), vacaciones pendientes (15 dias habiles por año menos las tomadas, art. 189) e indemnizacion art. 64 si es despido sin justa causa (indefinido: 30 dias + 20 por año adicional, o 20 + 15 si gana 10 SMMLV o mas; fijo: salarios hasta el fin pactado) | Dr 2610 / Cr 2505; indemnizacion Dr 510560 |

- Siempre hay vista previa; al confirmar se guarda una fila por empleado (unique por empleado,
  tipo y periodo: no se paga dos veces) y un solo comprobante para el lote.
- Se usa TODO lo provisionado del concepto en el periodo (nominas aprobadas que empiezan en el
  periodo): si se paga mas, la diferencia es gasto (510530/510533/510536/510539); si se provisiono
  de mas, se recupera con credito a 5108.
- Retencion: prima, vacaciones y la parte gravada de cesantias/intereses (art. 206 num. 4 segun el
  salario en UVT) por procedimiento 1 sobre el pago solo; indemnizacion 20% si gana mas de 10 SMMLV
  (art. 401-3). Va a 236505.
- PDF para firmar (`GET /benefit-settlements/:id/pdf`).
- Simplificaciones: la base es el salario ACTUAL (si cambio en los ultimos 3 meses, el art. 253 pide
  el promedio del año: revisar); no descuenta licencias no remuneradas; las vacaciones se compensan
  con el salario ordinario sin promedio de recargos; no calcula la indemnizacion moratoria (art. 65)
  ni la sancion por no consignar cesantias a tiempo.

**Lo que NO calcula todavia** (para revisar con el contador):
- Deduccion adicional de 72 UVT por dependiente (Ley 2277 de 2022) y procedimiento 2 de retencion.
- Aprendices SENA (contrato de aprendizaje, cambiado por la Ley 2466 de 2025): no se liquidan aparte.
- Contratos de medio tiempo con IBC inferior al minimo (el IBC se sube siempre a 1 SMMLV).
- Jornadas pactadas distintas de 8 h diarias: lo que pase de 8 h en un dia se trata como extra.
- Topes legales de embargabilidad (ver "Deducciones recurrentes").

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
   `employerCostTotal`. Cesantias y prima se calculan sobre salario **+ auxilio de transporte**
   (Ley 1 de 1963, art. 7); vacaciones y aportes solo sobre la base salarial (corregido
   2026-11-23: antes cesantias y prima tampoco incluian el auxilio).
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
