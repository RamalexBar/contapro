import type { WithholdingConceptRecord } from "../domain/withholding-concept.repository";

export interface WithholdingDecision {
  applies: boolean;
  /** Tarifa a usar (la de no declarante si corresponde). */
  ratePercent: number;
  /** Por que no se practica (base por debajo del minimo). */
  reason?: string;
}

const formatCop = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;

/**
 * Si la empresa (compradora) le practica una retencion a su proveedor y con que tarifa:
 *
 * - Base minima: la retencion solo se practica si el pago alcanza `minBaseUvt` UVT (Decreto 572 de
 *   2025: compras desde 10 UVT, servicios desde 2 UVT, honorarios desde cualquier valor). En la
 *   ReteIVA el minimo se mide sobre el valor de la compra antes de IVA, no sobre el IVA.
 * - Tarifa: la de no declarante cuando el proveedor no declara renta y el concepto la tiene (servicios
 *   6 % en vez de 4 %, compras 3,5 % en vez de 2,5 %, honorarios 10 % en vez de 11 %). Solo en retencion
 *   en la fuente; ReteIVA y ReteICA no dependen de eso.
 *
 * Sin UVT del año (falta la fila de parametros) no se puede medir el minimo: se practica.
 */
export function resolvePurchaseWithholding(params: {
  concept: Pick<WithholdingConceptRecord, "type" | "ratePercent" | "minBaseUvt" | "nonDeclarantRatePercent" | "code">;
  /** Base de la retencion (en ReteIVA, el IVA). */
  base: number;
  /** Subtotal de la compra antes de IVA. */
  purchaseSubtotal: number;
  supplierDeclarant: boolean;
  uvt: number | null;
}): WithholdingDecision {
  const { concept, uvt } = params;
  const ratePercent =
    concept.type === "RETEFUENTE" && !params.supplierDeclarant && concept.nonDeclarantRatePercent !== null
      ? concept.nonDeclarantRatePercent
      : concept.ratePercent;

  if (concept.minBaseUvt > 0 && uvt && uvt > 0) {
    const minimum = concept.minBaseUvt * uvt;
    const measured = concept.type === "RETEIVA" ? params.purchaseSubtotal : params.base;
    if (measured < minimum) {
      return {
        applies: false,
        ratePercent,
        reason: `${concept.code}: ${formatCop(measured)} no alcanza la base minima de ${concept.minBaseUvt} UVT (${formatCop(minimum)})`,
      };
    }
  }
  return { applies: true, ratePercent };
}
