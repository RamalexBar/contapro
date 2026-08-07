import type { Prisma } from "@prisma/client";

/**
 * Categorias de gasto con las que arranca cada empresa -- codigos PUC comunes de gastos de
 * administracion, sin verificar contra un contador real (mismo criterio de honestidad que
 * DEFAULT_WITHHOLDING_CONCEPTS). "DIVERSOS" apunta a proposito a la misma cuenta 5195 que ya usa
 * PostCashSessionAdjustmentJournalEntryUseCase para faltantes de caja -- sinergia intencional,
 * upsertByCode la encuentra en vez de duplicarla.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { code: "ARRIENDO", name: "Arrendamientos", accountCode: "5120" },
  { code: "SERVICIOS", name: "Servicios publicos", accountCode: "5135" },
  { code: "HONORARIOS", name: "Honorarios", accountCode: "5110" },
  { code: "MANTENIMIENTO", name: "Mantenimiento y reparaciones", accountCode: "5145" },
  { code: "PUBLICIDAD", name: "Publicidad y propaganda", accountCode: "5165" },
  { code: "PAPELERIA", name: "Papeleria y utiles de oficina", accountCode: "5155" },
  { code: "DIVERSOS", name: "Diversos (otros gastos)", accountCode: "5195" },
];

/**
 * Siembra las categorias de gasto por defecto para UNA empresa (idempotente, upsert por
 * companyId+code -- no pisa una categoria que la empresa ya haya editado desde la UI). Dos
 * llamadores: RegisterCompanyUseCase (apps/api) justo despues de crear una empresa nueva, y el
 * loop de backfill en seedBase() (prisma/seed-base.ts) para empresas que ya existian antes de
 * este item. Mismo patron que seedDefaultWithholdingConcepts.
 */
export async function seedDefaultExpenseCategories(prisma: Prisma.TransactionClient, companyId: string) {
  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { companyId_code: { companyId, code: category.code } },
      create: { companyId, ...category },
      update: {},
    });
  }
}
