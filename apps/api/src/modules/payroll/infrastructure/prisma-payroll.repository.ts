import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreatePayrollData,
  EmployeeCalculationResult,
  IPayrollRepository,
  PayrollRecord,
  PayrollWithDetails,
  PayslipDocumentRecord,
} from "../domain/payroll.repository";

export class PrismaPayrollRepository implements IPayrollRepository {
  async create(data: CreatePayrollData): Promise<PayrollRecord> {
    const companyId = getTenantContext().companyId;
    try {
      return await prisma.payroll.create({
        data: {
          companyId,
          branchId: data.branchId,
          year: data.year,
          month: data.month,
          periodType: data.periodType,
          startDate: data.startDate,
          endDate: data.endDate,
          createdByUserId: data.createdByUserId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe un periodo de nomina ${data.periodType} para ${data.month}/${data.year}`);
      }
      throw err;
    }
  }

  async findByIdOrThrow(id: string): Promise<PayrollRecord> {
    const payroll = await prisma.payroll.findFirst({ where: { id } });
    if (!payroll) throw new NotFoundError("Payroll", id);
    return payroll;
  }

  async findWithDetailsOrThrow(id: string): Promise<PayrollWithDetails> {
    const payroll = await prisma.payroll.findFirst({
      where: { id },
      include: { details: { include: { items: true, payslip: true } } },
    });
    if (!payroll) throw new NotFoundError("Payroll", id);
    return {
      ...payroll,
      details: payroll.details.map((detail) => ({
        id: detail.id,
        employeeId: detail.employeeId,
        grossTotal: Number(detail.grossTotal),
        totalDeductions: Number(detail.totalDeductions),
        netPay: Number(detail.netPay),
        employerCostTotal: Number(detail.employerCostTotal),
        status: detail.status,
        items: detail.items.map((item) => ({
          id: item.id,
          conceptCode: item.conceptCode,
          quantity: item.quantity ? Number(item.quantity) : null,
          rate: item.rate ? Number(item.rate) : null,
          amount: Number(item.amount),
          payrollDeductionId: item.payrollDeductionId,
        })),
        payslip: detail.payslip
          ? {
              id: detail.payslip.id,
              generatedAt: detail.payslip.generatedAt,
              fileUrl: detail.payslip.fileUrl,
              summaryJson: detail.payslip.summaryJson as Record<string, unknown>,
            }
          : null,
      })),
    };
  }

  /**
   * PayslipDocument no tiene columna companyId (ver payroll.prisma) por lo que NO esta cubierto
   * por la extension automatica de aislamiento multi-tenant; se filtra a mano via la relacion
   * payrollDetail -> payroll -> companyId.
   */
  async findPayslipByIdOrThrow(id: string): Promise<PayslipDocumentRecord> {
    const companyId = getTenantContext().companyId;
    const payslip = await prisma.payslipDocument.findFirst({
      where: { id, payrollDetail: { payroll: { companyId } } },
    });
    if (!payslip) throw new NotFoundError("PayslipDocument", id);
    return {
      id: payslip.id,
      payrollDetailId: payslip.payrollDetailId,
      generatedAt: payslip.generatedAt,
      fileUrl: payslip.fileUrl,
      summaryJson: payslip.summaryJson as Record<string, unknown>,
    };
  }

  async list(filter?: { year?: number; branchId?: string }): Promise<PayrollRecord[]> {
    return prisma.payroll.findMany({
      where: { year: filter?.year, branchId: filter?.branchId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async saveCalculationResults(payrollId: string, results: EmployeeCalculationResult[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existingDetails = await tx.payrollDetail.findMany({ where: { payrollId }, select: { id: true } });
      const existingIds = existingDetails.map((d) => d.id);
      if (existingIds.length > 0) {
        await tx.payrollItem.deleteMany({ where: { payrollDetailId: { in: existingIds } } });
        await tx.payslipDocument.deleteMany({ where: { payrollDetailId: { in: existingIds } } });
        await tx.payrollDetail.deleteMany({ where: { id: { in: existingIds } } });
      }

      for (const result of results) {
        const detail = await tx.payrollDetail.create({
          data: {
            payrollId,
            employeeId: result.employeeId,
            grossTotal: result.grossTotal,
            totalDeductions: result.totalDeductions,
            netPay: result.netPay,
            employerCostTotal: result.employerCostTotal,
            status: "CALCULATED",
          },
        });

        if (result.items.length > 0) {
          await tx.payrollItem.createMany({
            data: result.items.map((item) => ({
              payrollDetailId: detail.id,
              conceptCode: item.conceptCode,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              payrollDeductionId: item.payrollDeductionId,
            })),
          });
        }

        await tx.payslipDocument.create({
          data: { payrollDetailId: detail.id, summaryJson: result.summary as Prisma.InputJsonValue },
        });
      }
    });
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: { calculatedAt?: Date; paidAt?: Date }
  ): Promise<PayrollRecord> {
    const existing = await prisma.payroll.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Payroll", id);
    return prisma.payroll.update({
      where: { id },
      data: { status, calculatedAt: extra?.calculatedAt, paidAt: extra?.paidAt },
    });
  }
}
