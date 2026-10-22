import { z } from "zod";

// Strings planos opcionales SIN catalogo/enum (mismo criterio que Customer.dian*, ver
// tenant.prisma) -- este codebase deliberadamente no inventa catalogos DIAN sin verificar.
export const updateCompanyProfileSchema = z.object({
  legalName: z.string().trim().min(1, "Escribe el nombre o razón social").optional(),
  // Se quitan puntos y espacios ("900.123.456" -> "900123456"); el DV va aparte, en "dv".
  nit: z
    .string()
    .transform((v) => v.replace(/[.\s]/g, ""))
    .pipe(z.string().regex(/^\d{5,15}$/, "Escribe solo los números del NIT o la cédula, sin el dígito de verificación"))
    .optional(),
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
