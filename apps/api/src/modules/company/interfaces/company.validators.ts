import { z } from "zod";

// Strings planos opcionales SIN catalogo/enum (mismo criterio que Customer.dian*, ver
// tenant.prisma) -- este codebase deliberadamente no inventa catalogos DIAN sin verificar.
//
// Logo reducido en el navegador antes de enviarlo (ver CompanyProfilePage): ~300KB de base64 como
// tope, de sobra para un logo y sin inflar cada lectura del perfil.
export const MAX_LOGO_DATA_URL_LENGTH = 400_000;

export const updateCompanyProfileSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre comercial").optional(),
  email: z.string().trim().email("Escribe un correo válido").optional(),
  economicActivity: z.string().trim().min(1).nullable().optional(),
  whatsapp: z.string().trim().min(1).nullable().optional(),
  website: z.string().trim().min(1).nullable().optional(),
  instagram: z.string().trim().min(1).nullable().optional(),
  receiptHeader: z.string().trim().min(1).max(300).nullable().optional(),
  receiptFooter: z.string().trim().min(1).max(300).nullable().optional(),
  logoUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "El logo debe ser una imagen PNG o JPG")
    .max(MAX_LOGO_DATA_URL_LENGTH, "El logo es muy pesado; usa una imagen más pequeña")
    .nullable()
    .optional(),
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
