import type { Prisma } from "@prisma/client";

/**
 * Conceptos de retencion (WithholdingConcept) con los que arranca cada empresa -- tarifas
 * comunes de mercado, editables despues por la empresa (ver accounting.routes.ts). El de ICA
 * queda deliberadamente como placeholder: la tarifa real depende del municipio/actividad
 * economica de cada empresa, imposible de acertar con un solo valor por defecto (ver
 * docs/ALCANCE.md, item 29).
 */
export const DEFAULT_WITHHOLDING_CONCEPTS = [
  { code: "RF-COMPRAS", name: "Compras generales", type: "RETEFUENTE" as const, ratePercent: 2.5 },
  { code: "RF-SERVICIOS", name: "Servicios generales", type: "RETEFUENTE" as const, ratePercent: 4 },
  { code: "RF-HONORARIOS", name: "Honorarios", type: "RETEFUENTE" as const, ratePercent: 11 },
  { code: "RF-ARRENDAMIENTOS", name: "Arrendamientos", type: "RETEFUENTE" as const, ratePercent: 3.5 },
  { code: "ICA-GENERAL", name: "ICA (ajustar tarifa a tu municipio/actividad)", type: "RETEICA" as const, ratePercent: 1 },
  { code: "IVA-RETE", name: "Retencion de IVA", type: "RETEIVA" as const, ratePercent: 15 },
];

/**
 * Siembra los conceptos de retencion por defecto para UNA empresa (idempotente, upsert por
 * companyId+code -- seguro de re-ejecutar, no pisa una tarifa que la empresa ya haya editado
 * desde la UI). Dos llamadores: RegisterCompanyUseCase (apps/api) justo despues de crear una
 * empresa nueva, y el loop de backfill en seedBase() (prisma/seed-base.ts) para empresas que ya
 * existian antes de este item. Vive en @erp/database (no en prisma/seed-base.ts, un script que
 * apps/api no puede importar) para que ambos llamadores reusen la misma lista.
 */
export async function seedDefaultWithholdingConcepts(prisma: Prisma.TransactionClient, companyId: string) {
  for (const concept of DEFAULT_WITHHOLDING_CONCEPTS) {
    await prisma.withholdingConcept.upsert({
      where: { companyId_code: { companyId, code: concept.code } },
      create: { companyId, ...concept },
      update: {},
    });
  }
}
