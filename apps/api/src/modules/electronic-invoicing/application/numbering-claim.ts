import { ConflictError } from "../../../shared/errors/app-error";

export interface ResolutionForClaim {
  resolutionNumber: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  currentNumber: number;
}

/**
 * Calcula el siguiente numero de factura a partir de una resolucion DIAN, sin tocar la base de
 * datos -- la funcion pura que hace el calculo de "cual es el siguiente numero" separada del
 * incremento atomico en Postgres (ver prisma-electronic-invoice.repository.ts), para poder
 * probarla sin una base de datos real.
 * `currentNumber === 0` significa que la resolucion todavia no ha entregado ningun numero, por
 * lo que el primero entregado es `rangeFrom`, no `rangeFrom + 1`.
 */
export function computeNextInvoiceNumber(resolution: ResolutionForClaim): { number: number; fullNumber: string } {
  const number = resolution.currentNumber === 0 ? resolution.rangeFrom : resolution.currentNumber + 1;

  if (number > resolution.rangeTo) {
    throw new ConflictError(
      `La resolucion de numeracion DIAN ${resolution.resolutionNumber} agoto su rango autorizado (${resolution.rangeFrom}-${resolution.rangeTo})`
    );
  }

  return { number, fullNumber: `${resolution.prefix}${number}` };
}
