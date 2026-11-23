export { createPayrollDeductionSchema, createPayrollParameterSchema, createPayrollSchema } from "@erp/shared-types";

import { z } from "zod";

export const updatePayrollSettingsSchema = z.object({ exemptArt1141: z.boolean() });
