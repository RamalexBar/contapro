import { describe, expect, it } from "vitest";
import type { AuditService } from "../../../audit/application/audit.service";
import type { CompanyRecord, ICompanyReader } from "../../domain/company-reader.repository";
import { UpdatePayrollSettingsUseCase } from "./update-payroll-settings.use-case";

class FakeCompanyReader implements ICompanyReader {
  company: CompanyRecord = { id: "c1", nit: "900", legalName: "X SAS", name: "X", payrollExemptArt1141: false };
  async findByIdOrThrow(): Promise<CompanyRecord> {
    return { ...this.company };
  }
  async setPayrollExemptArt1141(_id: string, exempt: boolean): Promise<CompanyRecord> {
    this.company = { ...this.company, payrollExemptArt1141: exempt };
    return { ...this.company };
  }
}

function makeAudit() {
  const records: unknown[] = [];
  return { records, service: { record: async (r: unknown) => void records.push(r) } as unknown as AuditService };
}

describe("UpdatePayrollSettingsUseCase", () => {
  it("turns the art. 114-1 exemption on and audits the change", async () => {
    const reader = new FakeCompanyReader();
    const audit = makeAudit();
    const useCase = new UpdatePayrollSettingsUseCase(reader, audit.service);

    expect(await useCase.execute("c1", { exemptArt1141: true })).toEqual({ exemptArt1141: true });
    expect(await useCase.get("c1")).toEqual({ exemptArt1141: true });
    expect(audit.records).toHaveLength(1);
  });

  it("does not audit when nothing changes", async () => {
    const audit = makeAudit();
    await new UpdatePayrollSettingsUseCase(new FakeCompanyReader(), audit.service).execute("c1", { exemptArt1141: false });
    expect(audit.records).toHaveLength(0);
  });
});
