import { z } from "zod";

export const createCustomerSchema = z.object({
  documentType: z.string().min(2),
  documentNumber: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  // Item 35 de docs/ALCANCE.md (listas de precios).
  priceListId: z.string().uuid().optional(),
  // Item 37 de docs/ALCANCE.md (informacion exogena DIAN): codigo DANE de municipio.
  municipalityCode: z.string().optional(),
});

export const updateCustomerPriceListSchema = z.object({
  priceListId: z.string().uuid().nullable(),
});
