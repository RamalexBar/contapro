import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateEmployeeData,
  EmployeeRecord,
  IEmployeeRepository,
  UpdateEmployeeData,
} from "../domain/employee.repository";

type EmployeeRow = {
  id: string;
  companyId: string;
  branchId: string;
  userId: string | null;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  secondLastName: string | null;
  workerType: string;
  workerSubtype: string;
  birthDate: Date | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  position: string;
  contractType: string;
  baseSalary: Prisma.Decimal;
  hireDate: Date;
  terminationDate: Date | null;
  status: string;
  eps: string | null;
  arlRiskLevel: string | null;
  pensionFund: string | null;
  compensationFund: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
};

function toRecord(row: EmployeeRow): EmployeeRecord {
  return { ...row, baseSalary: Number(row.baseSalary) };
}

export class PrismaEmployeeRepository implements IEmployeeRepository {
  async create(data: CreateEmployeeData): Promise<EmployeeRecord> {
    const companyId = getTenantContext().companyId;
    try {
      const row = await prisma.employee.create({
        data: {
          companyId,
          branchId: data.branchId,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          secondLastName: data.secondLastName,
          workerType: data.workerType,
          workerSubtype: data.workerSubtype,
          birthDate: data.birthDate,
          address: data.address,
          phone: data.phone,
          email: data.email,
          position: data.position,
          contractType: data.contractType,
          baseSalary: data.baseSalary,
          hireDate: data.hireDate,
          eps: data.eps,
          arlRiskLevel: data.arlRiskLevel,
          pensionFund: data.pensionFund,
          compensationFund: data.compensationFund,
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
        },
      });
      return toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe un empleado con el documento ${data.documentNumber}`);
      }
      throw err;
    }
  }

  async findById(id: string): Promise<EmployeeRecord | null> {
    const row = await prisma.employee.findFirst({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByIdOrThrow(id: string): Promise<EmployeeRecord> {
    const employee = await this.findById(id);
    if (!employee) throw new NotFoundError("Employee", id);
    return employee;
  }

  async findByUserId(userId: string): Promise<EmployeeRecord | null> {
    const row = await prisma.employee.findFirst({ where: { userId } });
    return row ? toRecord(row) : null;
  }

  async list(filter?: { branchId?: string; status?: string }): Promise<EmployeeRecord[]> {
    const rows = await prisma.employee.findMany({
      where: { branchId: filter?.branchId, status: filter?.status },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return rows.map(toRecord);
  }

  async update(id: string, data: UpdateEmployeeData): Promise<EmployeeRecord> {
    await this.assertBelongsToCompany(id);
    const row = await prisma.employee.update({ where: { id }, data });
    return toRecord(row);
  }

  async deactivate(id: string, terminationDate: Date): Promise<EmployeeRecord> {
    await this.assertBelongsToCompany(id);
    const row = await prisma.employee.update({
      where: { id },
      data: { status: "INACTIVE", terminationDate },
    });
    return toRecord(row);
  }

  async listActiveForPeriod(branchId: string | null, startDate: Date, endDate: Date): Promise<EmployeeRecord[]> {
    const rows = await prisma.employee.findMany({
      where: {
        branchId: branchId ?? undefined,
        hireDate: { lte: endDate },
        OR: [{ terminationDate: null }, { terminationDate: { gte: startDate } }],
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return rows.map(toRecord);
  }

  private async assertBelongsToCompany(id: string): Promise<void> {
    const existing = await prisma.employee.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Employee", id);
  }
}
