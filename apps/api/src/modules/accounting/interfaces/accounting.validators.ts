import { z } from "zod";

export {
  createAccountSchema,
  updateAccountSchema,
  createJournalEntrySchema,
  createBankAccountSchema,
  registerBankTransactionSchema,
  startBankReconciliationSchema,
  matchBankReconciliationItemSchema,
  createWithholdingConceptSchema,
  updateWithholdingConceptSchema,
  createCostCenterSchema,
  updateCostCenterSchema,
} from "@erp/shared-types";

// Mismo limite y razonamiento que MAX_INVOICE_BASE64_LENGTH en suppliers.validators.ts: cubre una
// foto de celular o un PDF escaneado de un extracto de varias paginas, con margen bajo el limite
// de 20mb del body JSON completo (ver express.json({ limit }) en app.ts).
const MAX_STATEMENT_BASE64_LENGTH = 13_000_000;

export const extractBankStatementSchema = z.object({
  fileBase64: z.string().min(1).max(MAX_STATEMENT_BASE64_LENGTH),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});
