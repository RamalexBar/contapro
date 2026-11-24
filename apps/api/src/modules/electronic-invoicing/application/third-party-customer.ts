import type { CustomerRecord } from "../../customers/domain/customer.repository";
import type { ThirdPartyInvoiceCustomerInput } from "../domain/third-party-invoicing-client";
import { DIAN_GENERIC_FINAL_CONSUMER } from "./constants";

export interface Buyer {
  documentType: string;
  documentNumber: string;
  name: string;
}

export function buyerOf(customer: CustomerRecord | null): Buyer {
  return customer
    ? { documentType: customer.documentType, documentNumber: customer.documentNumber, name: customer.name }
    : DIAN_GENERIC_FINAL_CONSUMER;
}

/** Comprador tal como lo recibe el proveedor tecnologico (factura y notas usan el mismo). */
export function toThirdPartyCustomer(buyer: Buyer, customer: CustomerRecord | null): ThirdPartyInvoiceCustomerInput {
  return {
    documentType: buyer.documentType,
    documentNumber: buyer.documentNumber,
    name: buyer.name,
    email: customer?.email ?? null,
    phone: customer?.phone ?? null,
    address: customer?.address ?? null,
    postalCode: customer?.dianPostalCode ?? null,
    countryId: customer?.dianCountryId ?? null,
    // Factus exige el municipio del comprador; el formulario de clientes pide el codigo DANE.
    cityId: customer?.dianCityId ?? customer?.municipalityCode ?? null,
    identityDocumentId: customer?.dianIdentityDocumentId ?? null,
    typeOrganizationId: customer?.dianTypeOrganizationId ?? null,
    taxRegimeId: customer?.dianTaxRegimeId ?? null,
    taxLevelId: customer?.dianTaxLevelId ?? null,
  };
}
