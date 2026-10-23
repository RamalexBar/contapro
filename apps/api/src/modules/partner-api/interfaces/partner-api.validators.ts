import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const provisionPartnerAccountSchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  company: z.object({
    name: z.string().trim().min(2).max(150),
    legalName: z.string().trim().min(2).max(150),
    // Solo numeros, sin el digito de verificacion (va aparte en `dv`).
    nit: z
      .string()
      .transform((v) => v.replace(/[.\s-]/g, ""))
      .pipe(z.string().regex(/^\d{5,15}$/, "El NIT son solo numeros, sin el digito de verificacion")),
    dv: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null || v === "" ? null : String(v))).pipe(z.string().regex(/^\d$/).nullable()),
    documentType: z.enum(["NIT", "CC"]).default("NIT"),
    email: z.string().trim().email(),
    phone: optionalText(30),
    address: optionalText(150),
    city: optionalText(80),
  }),
  owner: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
  }),
  paidUntil: z.coerce.date(),
  issueApiKey: z.boolean().default(false),
});
