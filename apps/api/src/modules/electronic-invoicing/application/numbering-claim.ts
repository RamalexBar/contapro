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

/**
 * Reclama el numero de forma atomica dentro de la transaccion Prisma ya abierta -- usada por los
 * 4 repositorios *ElectronicInvoice/CreditNote/DebitNote/SupportDocument. Bug real encontrado y
 * corregido aqui (confirmado en vivo disparando ventas en paralelo, choque real contra
 * `ElectronicInvoice.@@unique([companyId, prefix, number])`): los 4 llamaban a
 * `computeNextInvoiceNumber(resolution)` con un `resolution` leido por un `findFirst` normal
 * (sin lock), y DESPUES incrementaban `currentNumber` en la base de datos -- el incremento en si
 * era atomico, pero el NUMERO ya se habia calculado antes, a partir de una lectura que dos
 * transacciones concurrentes podian compartir. Esta version deriva el numero directamente del
 * valor que devuelve el propio UPDATE atomico, asi que dos transacciones concurrentes nunca
 * pueden terminar con el mismo numero.
 *
 * El primer numero de una resolucion nueva es `rangeFrom` (no `rangeFrom + 1`, `currentNumber`
 * arranca en 0) -- se resuelve con un compare-and-swap (`updateMany` con `where: currentNumber:
 * 0`): si dos transacciones ven `currentNumber` en 0 a la vez, el UPDATE de la base de datos solo
 * afecta una fila para la primera que llega (`count === 1`); la otra ve `count === 0` y cae al
 * camino normal de incremento, que para entonces ya ve el `currentNumber` que puso la ganadora.
 */
export async function claimNextDocumentNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  resolution: ResolutionForClaim & { id: string }
): Promise<{ number: number; fullNumber: string }> {
  let number: number;

  if (resolution.currentNumber === 0) {
    const claimed = await tx.invoiceNumberingResolution.updateMany({
      where: { id: resolution.id, currentNumber: 0 },
      data: { currentNumber: resolution.rangeFrom },
    });
    if (claimed.count === 1) {
      number = resolution.rangeFrom;
    } else {
      const updated = await tx.invoiceNumberingResolution.update({
        where: { id: resolution.id },
        data: { currentNumber: { increment: 1 } },
      });
      number = updated.currentNumber;
    }
  } else {
    const updated = await tx.invoiceNumberingResolution.update({
      where: { id: resolution.id },
      data: { currentNumber: { increment: 1 } },
    });
    number = updated.currentNumber;
  }

  if (number > resolution.rangeTo) {
    throw new ConflictError(
      `La resolucion de numeracion DIAN ${resolution.resolutionNumber} agoto su rango autorizado (${resolution.rangeFrom}-${resolution.rangeTo})`
    );
  }

  return { number, fullNumber: `${resolution.prefix}${number}` };
}
