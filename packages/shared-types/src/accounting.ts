import { z } from "zod";

export const accountTypeEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);

export const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeEnum,
  parentId: z.string().uuid().optional(),
  acceptsEntries: z.boolean().default(true),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const journalEntryLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  description: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  branchId: z.string().uuid().optional(),
  date: z.coerce.date(),
  description: z.string().min(1),
  lines: z.array(journalEntryLineSchema).min(2),
  // Item 34 de docs/ALCANCE.md (centros de costo) -- opcional, etiqueta el comprobante para poder
  // filtrar Estado de Resultados/Libro Mayor por el mismo id.
  costCenterId: z.string().uuid().optional(),
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const createCostCenterSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;

export const updateCostCenterSchema = z.object({
  name: z.string().min(1).optional(),
});
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  accountType: z.string().min(1),
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

export const registerBankTransactionSchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["DEBIT", "CREDIT"]),
});
export type RegisterBankTransactionInput = z.infer<typeof registerBankTransactionSchema>;

export const startBankReconciliationSchema = z.object({
  bankAccountId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  statementBalance: z.number(),
  bookBalance: z.number(),
});
export type StartBankReconciliationInput = z.infer<typeof startBankReconciliationSchema>;

export const matchBankReconciliationItemSchema = z
  .object({
    bankTransactionId: z.string().uuid().optional(),
    journalEntryLineId: z.string().uuid().optional(),
  })
  .refine((data) => data.bankTransactionId || data.journalEntryLineId, {
    message: "Debes indicar bankTransactionId y/o journalEntryLineId",
  });
export type MatchBankReconciliationItemInput = z.infer<typeof matchBankReconciliationItemSchema>;

export const withholdingTypeEnum = z.enum(["RETEFUENTE", "RETEICA", "RETEIVA"]);

export const createWithholdingConceptSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: withholdingTypeEnum,
  ratePercent: z.number().min(0).max(100),
  // Item 37 de docs/ALCANCE.md (informacion exogena DIAN, formato 1003): codigo numerico DIAN de
  // concepto de retencion (ej. 1301 compras, 1302 servicios).
  dianConceptCode: z.string().optional(),
});
export type CreateWithholdingConceptInput = z.infer<typeof createWithholdingConceptSchema>;

export const updateWithholdingConceptSchema = z.object({
  name: z.string().min(1).optional(),
  ratePercent: z.number().min(0).max(100).optional(),
  dianConceptCode: z.string().optional(),
});
export type UpdateWithholdingConceptInput = z.infer<typeof updateWithholdingConceptSchema>;

/** Reusado por createSaleSchema (pos) y createPurchaseSchema (suppliers) -- el mismo shape aplica
 * en ambas direcciones, solo cambia que cuenta contable termina afectando (ver
 * post-sale-journal-entry.use-case.ts / post-purchase-journal-entry.use-case.ts). */
export const withholdingApplicationSchema = z.object({
  withholdingConceptId: z.string().uuid(),
  base: z.number().positive(),
});
export type WithholdingApplicationInput = z.infer<typeof withholdingApplicationSchema>;
