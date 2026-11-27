import { ValidationError } from "../../../shared/errors/app-error";

interface SalaryCheckEmployee {
  firstName: string;
  lastName: string;
  baseSalary: number;
  salaryType: string;
  contractType: string;
  weeklyHours?: number | null;
}

const cop = (n: number) => `$${n.toLocaleString("es-CO")}`;
const names = (list: SalaryCheckEmployee[]) => list.map((e) => `${e.firstName} ${e.lastName}`).join(", ");

/**
 * Pisos legales del salario antes de liquidar una nomina:
 * - Salario ordinario: minimo 1 SMMLV (art. 145 CST); en tiempo parcial, proporcional a las horas pactadas
 *   sobre la jornada maxima legal (art. 147 CST y Ley 2101 de 2021: 42 horas desde julio de 2026).
 * - Salario integral: minimo 10 SMMLV + 30% de factor prestacional = 13 SMMLV (art. 132 CST).
 * - Aprendices (LEARNING) quedan por fuera: reciben apoyo de sostenimiento, no salario.
 */
export function assertLegalSalaries(employees: SalaryCheckEmployee[], minimumWage: number, maxWeeklyHours = 42): void {
  const belowMinimum = employees.filter(
    (e) => e.contractType !== "LEARNING" && e.salaryType !== "INTEGRAL" && e.baseSalary < minimumSalaryFor(e, minimumWage, maxWeeklyHours)
  );
  if (belowMinimum.length > 0) {
    const detail = belowMinimum
      .map((e) => `${e.firstName} ${e.lastName} (minimo ${cop(minimumSalaryFor(e, minimumWage, maxWeeklyHours))}${isPartTime(e, maxWeeklyHours) ? ` por ${e.weeklyHours} h/semana` : ""})`)
      .join(", ");
    throw new ValidationError(`El salario no puede ser menor al salario minimo: ${detail}. Corrija el salario en Empleados.`);
  }

  const invalidIntegral = employees.filter((e) => e.salaryType === "INTEGRAL" && e.baseSalary < 13 * minimumWage);
  if (invalidIntegral.length > 0) {
    throw new ValidationError(
      `El salario integral no puede ser menor a 13 salarios minimos (${cop(13 * minimumWage)}): ${names(invalidIntegral)}`
    );
  }
}

function isPartTime(e: SalaryCheckEmployee, maxWeeklyHours: number): boolean {
  return e.weeklyHours != null && e.weeklyHours < maxWeeklyHours;
}

/** Salario minimo que le corresponde: completo, o proporcional a sus horas si es de tiempo parcial. */
export function minimumSalaryFor(e: SalaryCheckEmployee, minimumWage: number, maxWeeklyHours: number): number {
  if (!isPartTime(e, maxWeeklyHours)) return minimumWage;
  return Math.round((minimumWage * e.weeklyHours!) / maxWeeklyHours);
}
