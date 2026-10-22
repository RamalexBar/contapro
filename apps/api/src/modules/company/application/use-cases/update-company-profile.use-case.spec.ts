import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { CompanyProfileRecord, ICompanyProfileRepository, UpdateCompanyProfileData } from "../../domain/company-profile.repository";
import { UpdateCompanyProfileUseCase } from "./update-company-profile.use-case";

class FakeCompanyProfileRepository implements ICompanyProfileRepository {
  company: CompanyProfileRecord = {
    id: "company-1", name: "Muebles", legalName: "Nombre Mal Escrito", nit: "1001", email: "a@b.com", phone: null,
    documentType: "CC", dv: null, taxRegime: null, fiscalResponsibilities: null, address: null, municipality: null,
    department: null, municipalityCode: null,
    economicActivity: null, whatsapp: null, website: null, instagram: null, receiptHeader: null, receiptFooter: null, logoUrl: null,
  };
  otherCompanyNits = ["900123456"];
  electronicInvoices = 0;

  async findByIdOrThrow() {
    return this.company;
  }
  async update(_id: string, data: UpdateCompanyProfileData) {
    this.company = { ...this.company, ...data };
    return this.company;
  }
  async isNitTakenByAnotherCompany(nit: string) {
    return this.otherCompanyNits.includes(nit);
  }
  async countElectronicInvoices() {
    return this.electronicInvoices;
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    return { id: "audit-1", metadata: input.metadata ?? null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function run(repo: FakeCompanyProfileRepository, data: UpdateCompanyProfileData) {
  const useCase = new UpdateCompanyProfileUseCase(repo, new AuditService(new FakeAuditLogRepository()));
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    () => useCase.execute(data)
  );
}

describe("UpdateCompanyProfileUseCase — corregir razon social y NIT", () => {
  it("corrects the legal name and the NIT while no electronic invoice has been issued", async () => {
    const repo = new FakeCompanyProfileRepository();
    const result = await run(repo, { legalName: "Alexander Barrios", nit: "1001292780" });
    expect(result).toMatchObject({ legalName: "Alexander Barrios", nit: "1001292780" });
  });

  it("rejects a NIT that another company already uses", async () => {
    await expect(run(new FakeCompanyProfileRepository(), { nit: "900123456" })).rejects.toThrow(/otra empresa/);
  });

  it("blocks a NIT change once electronic invoices exist, but still allows saving the same NIT", async () => {
    const repo = new FakeCompanyProfileRepository();
    repo.electronicInvoices = 3;
    await expect(run(repo, { nit: "2002" })).rejects.toThrow(/facturas electrónicas/);
    await expect(run(repo, { nit: "1001", legalName: "Otro Nombre" })).resolves.toMatchObject({ legalName: "Otro Nombre" });
  });
});
