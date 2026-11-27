import { ValidationError } from "../../../shared/errors/app-error";

interface SalaryCheckEmployee {
  firstName: string;
  lastName: string;
  baseSalary: number;
  salaryType: string;
  contractType: string;
}

const cop = (n: number) => `$${n.toLocaleString("es-CO")}`;
const names = (list: SalaryCheckEmployee[]) => list.map((e) => `${e.firstName} ${e.lastName}`).join(", ");

/**
 * Pisos legales del salario antes de liquidar una nomina:
 * - Salario ordinario: minimo 1 SMMLV (art. 145 CST). Contapro liquida jornada completa; el tiempo
 *   parcial no esta soportado todavia, asi que un salario menor es un error de digitacion o un caso
 *   que el sistema calcularia mal.
 * - Salario integral: minimo 10 SMMLV + 30% de factor prestacional = 13 SMMLV (art. 132 CST).
 * - Aprendices (LEARNING) quedan por fuera: reciben apoyo de sostenimiento, no salario.
 */
export function assertLegalSalaries(employees: SalaryCheckEmployee[], minimumWage: number): void {
  const belowMinimum = employees.filter(
    (e) => e.contractType !== "LEARNING" && e.salaryType !== "INTEGRAL" && e.baseSalary < minimumWage
  );
  if (belowMinimum.length > 0) {
    throw new ValidationError(
      `El salario no puede ser menor al salario minimo (${cop(minimumWage)}): ${names(belowMinimum)}. ` +
        "Corrija el salario en Empleados. Contapro todavia no liquida contratos de tiempo parcial."
    );
  }

  const invalidIntegral = employees.filter((e) => e.salaryType === "INTEGRAL" && e.baseSalary < 13 * minimumWage);
  if (invalidIntegral.length > 0) {
    throw new ValidationError(
      `El salario integral no puede ser menor a 13 salarios minimos (${cop(13 * minimumWage)}): ${names(invalidIntegral)}`
    );
  }
}
