import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicPayrollRecord, IElectronicPayrollRepository } from "../../domain/electronic-payroll.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import { DIAN_CONTRACT_TYPE_CODE } from "../constants";
import { generateCune } from "../cune-generator";
import { buildDianPayrollXml, type DianPayrollLine } from "../dian-payroll-xml-builder";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";

const EARNING_CODES = new Set(["SALARY", "TRANSPORT_ALLOWANCE", "OVERTIME_DAY", "OVERTIME_NIGHT", "NIGHT_SURCHARGE", "SUNDAY_SURCHARGE"]);
const DEDUCTION_CODES = new Set(["HEALTH_EMPLOYEE", "PENSION_EMPLOYEE"]);

export interface GenerateElectronicPayrollInput {
  payrollDetailId: string;
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  items: Array<{ conceptCode: string; amount: number }>;
}

/**
 * Analogo a GenerateElectronicCreditNoteUseCase, para nomina electronica -- ver el aviso de
 * cabecera de dian-payroll-xml-builder.ts para el alcance de lo que NO esta verificado aqui.
 */
export class GenerateElectronicPayrollUseCase {
  constructor(
    private readonly payrollRepo: IElectronicPayrollRepository,
    private readonly companyReader: ICompanyReader,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner
  ) {}

  async execute(input: GenerateElectronicPayrollInput): Promise<ElectronicPayrollRecord> {
    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);

    const issueDate = new Date();
    const earnings: DianPayrollLine[] = input.items.filter((i) => EARNING_CODES.has(i.conceptCode));
    const deductions: DianPayrollLine[] = input.items.filter((i) => DEDUCTION_CODES.has(i.conceptCode));
    const employeeName = [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName]
      .filter(Boolean)
      .join(" ");

    let generatedXmlContent = "";

    const doc = await this.payrollRepo.generateAndSave(
      {
        payrollDetailId: input.payrollDetailId,
        branchId: employee.branchId,
        issueDate,
        employeeDocumentType: employee.documentType,
        employeeDocumentNumber: employee.documentNumber,
        employeeName,
        grossTotal: input.grossTotal,
        totalDeductions: input.totalDeductions,
        netPay: input.netPay,
        environment: env.DIAN_ENVIRONMENT,
      },
      (fullNumber) => {
        const cune = generateCune({
          fullNumber,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          issueDate,
          grossTotal: input.grossTotal,
          totalDeductions: input.totalDeductions,
          netPay: input.netPay,
          issuerNit: company.nit.replace(/\D/g, ""),
          employeeDocumentNumber: employee.documentNumber,
          technicalKey: env.DIAN_TECHNICAL_KEY,
          environment: env.DIAN_ENVIRONMENT,
        });

        const xmlContent = buildDianPayrollXml({
          fullNumber,
          cune,
          issueDate,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          environment: env.DIAN_ENVIRONMENT,
          employer: { nit: company.nit, legalName: company.legalName, municipalityCode: null },
          employee: {
            documentType: employee.documentType,
            documentNumber: employee.documentNumber,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            secondLastName: employee.secondLastName,
            workerType: employee.workerType,
            workerSubtype: employee.workerSubtype,
            contractTypeCode: DIAN_CONTRACT_TYPE_CODE[employee.contractType] ?? "1",
            position: employee.position,
            hireDate: employee.hireDate,
            salary: employee.baseSalary,
          },
          earnings,
          deductions,
          grossTotal: input.grossTotal,
          totalDeductions: input.totalDeductions,
          netPay: input.netPay,
        });

        generatedXmlContent = xmlContent;
        return { cune, xmlContent };
      }
    );

    await this.audit.record({
      action: "ELECTRONIC_PAYROLL_GENERATED",
      entityType: "PayrollDetail",
      entityId: input.payrollDetailId,
      description: `Nomina electronica generada localmente: ${doc.fullNumber} (CUNE ${doc.cune.slice(0, 12)}...)`,
      metadata: { fullNumber: doc.fullNumber, cune: doc.cune },
    });

    if (env.DIAN_CERTIFICATE_PATH) {
      await signAndQueueElectronicDocument({
        certificateLoader: this.certificateLoader,
        xmlSigner: this.xmlSigner,
        submissionRepo: this.payrollRepo,
        audit: this.audit,
        certificatePath: env.DIAN_CERTIFICATE_PATH,
        certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
        documentId: doc.id,
        entityType: "PayrollDetail",
        sourceEntityId: input.payrollDetailId,
        fullNumber: doc.fullNumber,
        unsignedXml: generatedXmlContent,
        signingFailedAction: "ELECTRONIC_PAYROLL_SIGNING_FAILED",
        documentLabel: "la nomina electronica",
      });
    }

    return doc;
  }
}
