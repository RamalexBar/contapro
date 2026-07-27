# Modulo: Nomina Colombia (STUB)

Estado: **modelo de datos completo en Prisma (incluye parametros legales parametrizables),
sin motor de calculo implementado todavia.**

## Modelos ya disponibles (`packages/database/prisma/schema/payroll.prisma`)

- `PayrollParameter` — **todos los valores legales parametrizables por año** (salario minimo,
  auxilio de transporte, UVT, % salud/pension/ARL por nivel de riesgo, % cesantias/intereses/
  prima/vacaciones, % caja de compensacion/ICBF/SENA, % horas extra/recargos). Actualizar la
  legislacion de un año nuevo es crear una fila nueva, **sin tocar codigo**.
- `PayrollConcept` — catalogo de conceptos (devengados, deducciones, aportes patronales, provisiones).
- `Payroll` — periodo de nomina (mensual/quincenal) por empresa/sucursal.
- `PayrollDetail` + `PayrollItem` — el detalle por empleado y cada concepto liquidado.
- `PayslipDocument` — desprendible de pago (hoy solo el JSON resumen; el PDF queda para despues).

## Que falta implementar

1. Motor de liquidacion (`application/use-cases/calculate-payroll.use-case.ts`):
   - Tomar `Employee.baseSalary` + `PayrollParameter` vigente para el periodo.
   - Sumar horas extra/recargos desde `modules/timetracking` (`TimeEntry`).
   - Calcular auxilio de transporte (solo si `baseSalary <= 2 x salario minimo`, regla legal).
   - Calcular deducciones (salud 4%, pension 4%, embargos/libranzas si existen).
   - Calcular aportes patronales (salud, pension, ARL segun `arlRiskLevel`, caja de
     compensacion, ICBF, SENA) y provisiones (cesantias, intereses, prima, vacaciones).
2. Generacion de `PayrollDetail`/`PayrollItem` por empleado y su `PayslipDocument`.
3. Reportes: mensual (por periodo) y anual (consolidado), y el desprendible individual (PDF,
   via Supabase Storage, reutilizando `PayslipDocument.fileUrl`).
4. Integracion con `modules/accounting` (STUB): al aprobar una nomina, generar el `JournalEntry`
   correspondiente (gasto de nomina, pasivos laborales, retenciones).
5. Endpoint para administrar `PayrollParameter` por año (solo Administrador/Contador).

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/payroll.routes.ts`).
