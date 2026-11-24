import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicPayrollRecord, IElectronicPayrollRepository } from "../../domain/electronic-payroll.repository";
import type { IThirdPartyInvoicingClient, ThirdPartyPayrollInput, ThirdPartyPayrollItem } from "../../domain/third-party-invoicing-client";
import type { IXmlSigner } from "../../domain/xml-signer";
import { DIAN_CONTRACT_TYPE_CODE } from "../constants";
import { generateCune } from "../cune-generator";
import { buildDianPayrollXml, type DianPayrollLine } from "../dian-payroll-xml-builder";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { serializeProviderRequest, submitThirdPartyDocument } from "../submit-third-party-document";

const EARNING_CODES = new Set(["SALARY", "TRANSPORT_ALLOWANCE", "OVERTIME_DAY", "OVERTIME_NIGHT", "NIGHT_SURCHARGE", "SUNDAY_SURCHARGE"]);
const DEDUCTION_CODES = new Set(["HEALTH_EMPLOYEE", "PENSION_EMPLOYEE", "SOLIDARITY_FUND", "WITHHOLDING_TAX"]);

export interface GenerateElectronicPayrollInput {
  /** Detalle al que queda ligado el documento (el de la nomina que cierra el mes). */
  payrollDetailId: string;
  employeeId: string;
  year: number;
  month: number;
  /** MONTHLY o BIWEEKLY (las dos quincenas del mes ya vienen sumadas en items). */
  periodicity: "MONTHLY" | "BIWEEKLY";
  periodStart: Date;
  periodEnd: Date;
  /** Fecha de pago de cada nomina del mes. */
  paymentDates: Date[];
  /** Dias de salario del mes (sin vacaciones, incapacidades ni licencias, que van en sus conceptos). */
  daysWorked: number;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  items: ThirdPartyPayrollItem[];
}

/**
 * Nomina electronica de un empleado por un mes (Res. DIAN 000013 de 2021: se transmite mensualmente,
 * asi que en nomina quincenal las dos quincenas van en un solo documento).
 *
 * - Empresa con FACTUS: POST /v2/payrolls (Factus numera, calcula totales, genera el CUNE, firma y
 *   transmite). Ver el aviso de no verificado en buildPayrollPayload.
 * - Envio directo: XML propio (placeholder, ver dian-payroll-xml-builder.ts).
 */
export class GenerateElectronicPayrollUseCase {
  constructor(
    private readonly payrollRepo: IElectronicPayrollRepository,
    private readonly companyReader: ICompanyReader,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly providerClient: IThirdPartyInvoicingClient
  ) {}

  /** Nomina electronica ya generada de ese empleado en ese mes (no se emite dos veces). */
  findIssued(employeeId: string, year: number, month: number): Promise<{ payrollDetailId: string; status: string; fullNumber: string } | null> {
    return this.payrollRepo.findForEmployeeMonth(employeeId, year, month);
  }

  async execute(input: GenerateElectronicPayrollInput): Promise<ElectronicPayrollRecord> {
    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    const viaThirdParty = company.electronicInvoicingProvider === "FACTUS";
    if (viaThirdParty && !company.municipalityCode) {
      throw new ValidationError("Falta el codigo DANE del municipio de la empresa (Datos de la empresa): la nomina electronica lo exige como lugar de trabajo");
    }

    const issueDate = new Date();
    const earnings: DianPayrollLine[] = input.items.filter((i) => EARNING_CODES.has(i.conceptCode));
    const deductions: DianPayrollLine[] = input.items.filter((i) => DEDUCTION_CODES.has(i.conceptCode));
    const employeeName = [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName].filter(Boolean).join(" ");
    const contractTypeCode = DIAN_CONTRACT_TYPE_CODE[employee.contractType] ?? "2";

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
        // Con Factus, CUNE y XML son provisionales: los reemplazan los de Factus al aceptarse.
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
          employer: { nit: company.nit, legalName: company.legalName, municipalityCode: company.municipalityCode },
          employee: {
            documentType: employee.documentType,
            documentNumber: employee.documentNumber,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            secondLastName: employee.secondLastName,
            workerType: employee.workerType,
            workerSubtype: employee.workerSubtype,
            contractTypeCode,
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
      description: `Nomina electronica generada: ${doc.fullNumber} (${employeeName}, ${input.month}/${input.year})`,
      metadata: { fullNumber: doc.fullNumber },
    });

    if (viaThirdParty) {
      const retired =
        employee.terminationDate && employee.terminationDate.getTime() >= input.periodStart.getTime() && employee.terminationDate.getTime() <= input.periodEnd.getTime();
      const request: ThirdPartyPayrollInput = {
        referenceCode: `${doc.fullNumber}-${issueDate.getTime().toString(36)}`,
        year: input.year,
        month: input.month,
        periodicity: input.periodicity,
        paymentDates: input.paymentDates,
        payment: {
          method: employee.bankAccountNumber ? "TRANSFER" : "CASH",
          bankName: employee.bankName,
          accountNumber: employee.bankAccountNumber,
        },
        worker: {
          documentType: employee.documentType,
          documentNumber: employee.documentNumber,
          firstName: employee.firstName,
          otherNames: employee.middleName,
          firstSurname: employee.lastName,
          secondSurname: employee.secondLastName,
          address: employee.address ?? company.address ?? "No informado",
          municipalityCode: company.municipalityCode!,
          integralSalary: employee.salaryType === "INTEGRAL",
          workerTypeCode: employee.workerType || "01",
          workerSubtypeCode: employee.workerSubtype || "00",
          contractTypeCode,
          employeeCode: employee.documentNumber,
          salary: employee.baseSalary,
          entryDate: employee.hireDate,
          retirementDate: retired ? employee.terminationDate : null,
          daysWorked: input.daysWorked,
        },
        items: input.items,
        netPay: input.netPay,
      };
      await this.payrollRepo.saveProviderRequest(doc.id, serializeProviderRequest(request));
      const result = await submitThirdPartyDocument({
        encryptedCredential: company.factusCredentialsEncrypted,
        submit: (credentials) => this.providerClient.submitPayroll(credentials, request),
        apply: (r) => this.payrollRepo.applyThirdPartyResult(doc.id, r),
        audit: this.audit,
        entityType: "PayrollDetail",
        entityId: input.payrollDetailId,
        label: "Nomina electronica",
        internalNumber: doc.fullNumber,
        failedAction: "ELECTRONIC_PAYROLL_GENERATION_FAILED",
      });
      if (result?.status === "ACCEPTED") return { ...doc, fullNumber: result.number, cune: result.uniqueCode, status: "ACCEPTED" };
      if (result?.status === "REJECTED") return { ...doc, status: "REJECTED" };
      return doc;
    }

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
