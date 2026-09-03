import { describe, expect, it } from "vitest";
import { isCompanyProfileComplete } from "./is-company-profile-complete";
import type { CompanyProfileRecord } from "../domain/company-profile.repository";

const COMPLETE: CompanyProfileRecord = {
  id: "company-1",
  name: "Minimarket La Esquina",
  legalName: "Minimarket La Esquina S.A.S.",
  nit: "900123456-7",
  email: "contacto@minimarket.co",
  phone: null,
  documentType: "NIT",
  dv: "7",
  taxRegime: "Responsable de IVA",
  fiscalResponsibilities: "O-13",
  address: "Calle 10 # 20-30",
  municipality: "Manizales",
  department: "Caldas",
  municipalityCode: null,
};

describe("isCompanyProfileComplete", () => {
  it("is complete when every required field is set", () => {
    expect(isCompanyProfileComplete(COMPLETE)).toEqual({ complete: true, missingFields: [] });
  });

  it("lists each missing required field", () => {
    const result = isCompanyProfileComplete({ ...COMPLETE, dv: null, address: null });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toEqual(["dv", "address"]);
  });

  it("does not require phone or municipalityCode (not part of the wizard)", () => {
    const result = isCompanyProfileComplete({ ...COMPLETE, phone: null, municipalityCode: null });
    expect(result).toEqual({ complete: true, missingFields: [] });
  });
});
