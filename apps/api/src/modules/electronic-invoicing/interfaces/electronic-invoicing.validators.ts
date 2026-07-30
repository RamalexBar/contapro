import { z } from "zod";

export const createNumberingResolutionSchema = z.object({
  branchId: z.string().uuid().optional(),
  documentType: z.enum(["FACTURA_VENTA", "NOTA_CREDITO", "NOTA_DEBITO"]).optional(),
  resolutionNumber: z.string().min(1),
  prefix: z.string().min(1),
  rangeFrom: z.number().int().positive(),
  rangeTo: z.number().int().positive(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});
