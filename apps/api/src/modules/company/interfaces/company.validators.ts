import { z } from "zod";

// Strings planos opcionales SIN catalogo/enum (mismo criterio que Customer.dian*, ver
// tenant.prisma) -- este codebase deliberadamente no inventa catalogos DIAN sin verificar.
export const updateCompanyProfileSchema = z.object({
  phone: z.string().min(1).nullable().optional(),
  documentType: z.string().min(1).nullable().optional(),
  dv: z.string().min(1).nullable().optional(),
  taxRegime: z.string().min(1).nullable().optional(),
  fiscalResponsibilities: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  municipality: z.string().min(1).nullable().optional(),
  department: z.string().min(1).nullable().optional(),
  municipalityCode: z.string().min(1).nullable().optional(),
});
