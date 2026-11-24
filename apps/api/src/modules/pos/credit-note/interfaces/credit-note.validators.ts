import { z } from "zod";

/** Nota credito libre sobre una venta. Devolucion (1) y anulacion (2) salen de Devoluciones. */
export const createCreditNoteSchema = z.object({
  saleId: z.string().uuid(),
  conceptCode: z.enum(["3", "4", "5", "6"]),
  reason: z.string().trim().min(3).max(500),
  amount: z.number().positive(),
  settlement: z.enum(["CASH", "TRANSFER", "CREDIT_TO_ACCOUNT"]).optional(),
});
