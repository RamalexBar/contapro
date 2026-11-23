export { createPayrollDeductionSchema, createPayrollParameterSchema, createPayrollSchema } from "@erp/shared-types";

import { z } from "zod";

export const updatePayrollSettingsSchema = z.object({ exemptArt1141: z.boolean() });

const terminationReasons = ["RESIGNATION", "JUST_CAUSE", "WITHOUT_JUST_CAUSE", "END_OF_TERM", "MUTUAL_AGREEMENT"] as const;

export const settleBenefitsSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SERVICE_BONUS"), year: z.number().int().min(2000).max(2100), semester: z.union([z.literal(1), z.literal(2)]) }),
  z.object({ type: z.literal("SEVERANCE"), year: z.number().int().min(2000).max(2100) }),
  z.object({
    type: z.literal("TERMINATION"),
    employeeId: z.string().uuid(),
    reason: z.enum(terminationReasons),
    fixedTermEndDate: z.coerce.date().optional(),
  }),
]);
