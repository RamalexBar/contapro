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

/** `resolutionNumber` de las numeraciones internas que Contapro crea para un proveedor tecnologico. */
export const INTERNAL_THIRD_PARTY_RESOLUTION = "INTERNA-PROVEEDOR";

/** Prefijo de la numeracion interna por tipo: no choca con los prefijos que asigna Factus. */
const INTERNAL_PREFIX: Record<NoteDocumentType, string> = {
  NOTA_CREDITO: "CPNC",
  NOTA_DEBITO: "CPND",
  DOCUMENTO_SOPORTE: "CPDS",
};

export type NoteDocumentType = "NOTA_CREDITO" | "NOTA_DEBITO" | "DOCUMENTO_SOPORTE";

const DOCUMENT_LABEL: Record<NoteDocumentType, string> = {
  NOTA_CREDITO: "notas credito",
  NOTA_DEBITO: "notas debito",
  DOCUMENTO_SOPORTE: "documento soporte",
};

/**
 * Resolucion con la que se numera una nota credito/debito o un documento soporte.
 *
 * - Envio directo a la DIAN: la resolucion vigente que la empresa registro (nunca una interna).
 * - Proveedor tecnologico (Factus): el proveedor decide el numero legal con su propio rango, y las
 *   notas ni siquiera tienen resolucion DIAN. Contapro igual necesita un consecutivo propio para
 *   guardar el documento antes de enviarlo, asi que usa (y crea la primera vez) una numeracion
 *   interna sin limite real. Al aceptarse, el numero legal del proveedor reemplaza al interno.
 */
export async function findResolutionForClaim(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: { companyId: string; branchId: string; documentType: NoteDocumentType; viaThirdParty: boolean }
): Promise<ResolutionForClaim & { id: string }> {
  const { companyId, branchId, documentType, viaThirdParty } = params;

  if (viaThirdParty) {
    const prefix = INTERNAL_PREFIX[documentType];
    const existing = await tx.invoiceNumberingResolution.findFirst({ where: { companyId, documentType, prefix } });
    if (existing) return existing;
    return tx.invoiceNumberingResolution.create({
      data: {
        companyId,
        documentType,
        prefix,
        resolutionNumber: INTERNAL_THIRD_PARTY_RESOLUTION,
        rangeFrom: 1,
        rangeTo: 2_000_000_000,
        validFrom: new Date("2000-01-01T00:00:00Z"),
        validUntil: new Date("2100-01-01T00:00:00Z"),
      },
    });
  }

  const now = new Date();
  const resolution = await tx.invoiceNumberingResolution.findFirst({
    where: {
      companyId,
      documentType,
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
      resolutionNumber: { not: INTERNAL_THIRD_PARTY_RESOLUTION },
      OR: [{ branchId }, { branchId: null }],
    },
    orderBy: [{ branchId: "desc" }, { createdAt: "desc" }],
  });
  if (!resolution) {
    throw new ConflictError(`No hay una resolucion de numeracion DIAN vigente para ${DOCUMENT_LABEL[documentType]} en esta sucursal`);
  }
  return resolution;
}

/** "CRTE1933" -> { prefix: "CRTE", number: 1933 }. Null si el numero del proveedor no termina en digitos. */
export function splitProviderNumber(fullNumber: string): { prefix: string; number: number } | null {
  const match = /^(.*?)(\d+)$/.exec(fullNumber.trim());
  if (!match) return null;
  const number = Number(match[2]);
  return Number.isSafeInteger(number) ? { prefix: match[1] ?? "", number } : null;
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
