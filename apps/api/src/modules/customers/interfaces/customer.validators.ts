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
  // Catalogos del proveedor tecnologico DIAN (ver modules/electronic-invoicing/README.md).
  dianIdentityDocumentId: z.string().optional(),
  dianTypeOrganizationId: z.string().optional(),
  dianTaxRegimeId: z.string().optional(),
  dianTaxLevelId: z.string().optional(),
  dianCountryId: z.string().optional(),
  dianCityId: z.string().optional(),
  dianPostalCode: z.string().optional(),
});

export const updateCustomerPriceListSchema = z.object({
  priceListId: z.string().uuid().nullable(),
});
