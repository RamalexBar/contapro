import { z } from "zod";

export const loginPlatformAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createPlanSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative(),
  maxBranches: z.number().int().positive(),
  maxUsers: z.number().int().positive(),
  features: z.record(z.string(), z.unknown()).default({}),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  priceMonthly: z.number().nonnegative().optional(),
  priceYearly: z.number().nonnegative().optional(),
  maxBranches: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const createSubscriptionSchema = z.object({
  companyId: z.string().uuid(),
  planId: z.string().uuid(),
  status: z.enum(["TRIALING", "ACTIVE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"]).default("ACTIVE"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  startDate: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
});

export const registerSubscriptionPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  reference: z.string().optional(),
});

export const createSubscriptionCheckoutSchema = z.object({
  customerEmail: z.string().email(),
  redirectUrl: z.string().url().optional(),
});

// ~7MB en base64 (base64 pesa ~4/3 del binario, asi que son ~5MB reales) por archivo -- generoso
// para un PDF escaneado o una foto de cedula/RUT, con margen bajo el limite de 30mb del body JSON
// completo (5 archivos, ver express.json({ limit }) en app.ts).
const MAX_ACTIVATION_ATTACHMENT_BASE64_LENGTH = 7_000_000;

const factusActivationAttachmentSchema = z.object({
  filename: z.string().min(1),
  mediaType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  base64: z.string().min(1).max(MAX_ACTIVATION_ATTACHMENT_BASE64_LENGTH),
});

export const sendFactusActivationRequestSchema = z.object({
  integrationVersion: z.enum(["v1", "v2"]),
  rut: factusActivationAttachmentSchema,
  legalRepCertificate: factusActivationAttachmentSchema.nullable(),
  legalRepId: factusActivationAttachmentSchema,
  purchaseProof: factusActivationAttachmentSchema,
  logo: factusActivationAttachmentSchema,
});

/**
 * Passthrough deliberado: el payload real de Wompi puede traer mas campos de los que este
 * sistema usa (o cambiar con el tiempo) -- validar solo lo minimo necesario para procesar el
 * evento evita rechazar webhooks legitimos por un campo nuevo no contemplado aqui.
 */
export const wompiWebhookSchema = z
  .object({
    event: z.string(),
    data: z
      .object({
        transaction: z
          .object({
            id: z.string(),
            status: z.string(),
            reference: z.string(),
            amount_in_cents: z.number(),
          })
          .passthrough(),
      })
      .passthrough(),
    environment: z.string(),
    timestamp: z.number(),
    signature: z.object({
      properties: z.array(z.string()),
      checksum: z.string(),
    }),
  })
  .passthrough();
