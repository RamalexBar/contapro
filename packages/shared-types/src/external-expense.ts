import { z } from "zod";

/**
 * POST /api/public/v1/expenses (2026-10-02, ver public-api/README.md): gasto operativo pagado
 * desde la caja/banco del POS externo (no es una compra a proveedor -- no genera cuenta por
 * pagar, se contabiliza y se paga en el mismo momento, igual que CreateExpenseUseCase). El POS
 * manda `categoryCode`, no el id interno de la categoria: el contador la configura de antemano en
 * Contapro (con su cuenta PUC) y le pasa ese codigo al integrador del POS -- mismo criterio que
 * los conceptos de shift-close.ts.
 */
export const registerExternalExpenseSchema = z
  .object({
    branchId: z.string().uuid(),
    categoryCode: z.string().min(1),
    payeeName: z.string().min(2),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    subtotal: z.number().nonnegative(),
    taxTotal: z.number().nonnegative(),
    total: z.number().nonnegative(),
    paymentMethod: z.string().min(2),
    costCenterId: z.string().uuid().optional(),
  })
  .transform((v) => ({ ...v, date: v.date ?? new Date() }));
export type RegisterExternalExpenseInput = z.infer<typeof registerExternalExpenseSchema>;
