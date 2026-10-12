import { z } from "zod";
import { endOfDayInBogota, startOfDayInBogota } from "@erp/shared-utils";

export { stockEntrySchema, stockAdjustSchema } from "@erp/shared-types";

export const transferStockSchema = z.object({
  productId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const listKardexQuerySchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  // Dia completo en Colombia: "hasta hoy" incluye los movimientos de hoy (ver endOfDayInBogota).
  from: z.string().min(1).transform(startOfDayInBogota).optional(),
  to: z.string().min(1).transform(endOfDayInBogota).optional(),
});

export const listBranchStockQuerySchema = z.object({
  branchId: z.string().uuid(),
});
