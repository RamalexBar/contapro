import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { EmployeeRecord, IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { IWhatsAppSender, WhatsAppDocumentPayload } from "../../../whatsapp/domain/whatsapp-sender.port";
import type { IWhatsAppDeliveryLogRepository, RecordWhatsAppDeliveryData, WhatsAppDeliveryLogRecord } from "../../../whatsapp/domain/whatsapp-delivery-log.repository";
import type { CompanyRecord, ICompanyReader } from "../../domain/company-reader.repository";
import type { IPayrollRepository, PayslipDocumentRecord } from "../../domain/payroll.repository";
import { SendPayslipWhatsAppUseCase } from "./send-payslip-whatsapp.use-case";

const EMPLOYEE_WITH_PHONE: EmployeeRecord = {
  id: "employee-1",
  companyId: "company-1",
  branchId: "branch-1",
  userId: null,
  documentType: "CC",
  documentNumber: "1023456789",
  firstName: "Laura",
  lastName: "Gomez",
  middleName: null,
  secondLastName: null,
  workerType: "DEPENDIENTE",
  workerSubtype: "GENERAL",
  birthDate: null,
  address: null,
  phone: "3001234567",
  email: null,
  position: "Auxiliar de bodega",
  contractType: "INDEFINITE",
  baseSalary: 1400000,
  hireDate: new Date("2024-01-01"),
  terminationDate: null,
  status: "ACTIVE",
  eps: null,
  arlRiskLevel: null,
  pensionFund: null,
  compensationFund: null,
  bankName: null,
  bankAccountNumber: null,
};
const EMPLOYEE_NO_PHONE: EmployeeRecord = { ...EMPLOYEE_WITH_PHONE, id: "employee-2", phone: null };

const PAYSLIP: PayslipDocumentRecord = {
  id: "payslip-1",
  payrollDetailId: "detail-1",
  generatedAt: new Date("2026-08-01T00:00:00.000Z"),
  fileUrl: null,
  summaryJson: { employeeName: "Laura Gomez", daysWorked: 30, devengados: { salary: 1400000, total: 1400000 }, netPay: 1300000 },
};

const COMPANY: CompanyRecord = { id: "company-1", nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S.", name: "Minimarket" };

class FakeEmployeeRepository implements Partial<IEmployeeRepository> {
  constructor(private readonly employees: EmployeeRecord[]) {}
  async findByIdOrThrow(id: string): Promise<EmployeeRecord> {
    const found = this.employees.find((e) => e.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

class FakePayrollRepository implements Partial<IPayrollRepository> {
  async findPayslipByIdOrThrow(): Promise<PayslipDocumentRecord> {
    return PAYSLIP;
  }
}

class FakeCompanyReader implements ICompanyReader {
  async findByIdOrThrow(): Promise<CompanyRecord> {
    return COMPANY;
  }
}

class FakeWhatsAppSender implements IWhatsAppSender {
  sentDocuments: Array<{ to: string; doc: WhatsAppDocumentPayload }> = [];
  shouldFail = false;
  async sendText(): Promise<void> {
    throw new Error("not implemented");
  }
  async sendDocument(to: string, doc: WhatsAppDocumentPayload): Promise<void> {
    if (this.shouldFail) throw new Error("WHATSAPP_ACCESS_TOKEN no esta configurado");
    this.sentDocuments.push({ to, doc });
  }
}

class FakeDeliveryLogRepository implements Partial<IWhatsAppDeliveryLogRepository> {
  recorded: RecordWhatsAppDeliveryData[] = [];
  async record(data: RecordWhatsAppDeliveryData): Promise<WhatsAppDeliveryLogRecord> {
    this.recorded.push(data);
    return { id: `log-${this.recorded.length}`, sentAt: new Date(), errorMessage: data.errorMessage ?? null, ...data };
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  entries: CreateAuditLogInput[] = [];
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.entries.push(input);
    return { id: `audit-${this.entries.length}`, metadata: input.metadata ?? null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

describe("SendPayslipWhatsAppUseCase", () => {
  it("does nothing when the employee has no phone", async () => {
    const sender = new FakeWhatsAppSender();
    const deliveryRepo = new FakeDeliveryLogRepository();
    const useCase = new SendPayslipWhatsAppUseCase(
      new FakeEmployeeRepository([EMPLOYEE_NO_PHONE]) as unknown as IEmployeeRepository,
      new FakePayrollRepository() as unknown as IPayrollRepository,
      new FakeCompanyReader(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(new FakeAuditLogRepository())
    );

    await withTenantContext(() => useCase.execute({ payslipId: "payslip-1", employeeId: "employee-2" }));

    expect(sender.sentDocuments).toHaveLength(0);
    expect(deliveryRepo.recorded).toHaveLength(0);
  });

  it("renders the payslip and sends it, recording success", async () => {
    const sender = new FakeWhatsAppSender();
    const deliveryRepo = new FakeDeliveryLogRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SendPayslipWhatsAppUseCase(
      new FakeEmployeeRepository([EMPLOYEE_WITH_PHONE]) as unknown as IEmployeeRepository,
      new FakePayrollRepository() as unknown as IPayrollRepository,
      new FakeCompanyReader(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(auditRepo)
    );

    await withTenantContext(() => useCase.execute({ payslipId: "payslip-1", employeeId: "employee-1" }));

    expect(sender.sentDocuments).toHaveLength(1);
    expect(sender.sentDocuments[0].to).toBe("573001234567");
    expect(sender.sentDocuments[0].doc.buffer.byteLength).toBeGreaterThan(0);
    expect(deliveryRepo.recorded).toEqual([
      expect.objectContaining({ messageType: "PAYSLIP", referenceId: "payslip-1", success: true }),
    ]);
    expect(auditRepo.entries.some((e) => e.action === "WHATSAPP_PAYSLIP_SENT")).toBe(true);
  });

  it("records a failure without throwing when the sender fails", async () => {
    const sender = new FakeWhatsAppSender();
    sender.shouldFail = true;
    const deliveryRepo = new FakeDeliveryLogRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SendPayslipWhatsAppUseCase(
      new FakeEmployeeRepository([EMPLOYEE_WITH_PHONE]) as unknown as IEmployeeRepository,
      new FakePayrollRepository() as unknown as IPayrollRepository,
      new FakeCompanyReader(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(auditRepo)
    );

    await withTenantContext(() => useCase.execute({ payslipId: "payslip-1", employeeId: "employee-1" }));

    expect(deliveryRepo.recorded).toEqual([expect.objectContaining({ messageType: "PAYSLIP", success: false })]);
    expect(auditRepo.entries.some((e) => e.action === "WHATSAPP_PAYSLIP_SEND_FAILED")).toBe(true);
  });
});
