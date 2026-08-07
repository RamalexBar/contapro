import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateWithholdingConceptData,
  IWithholdingConceptRepository,
  UpdateWithholdingConceptData,
  WithholdingConceptRecord,
  WithholdingType,
} from "../domain/withholding-concept.repository";

export class PrismaWithholdingConceptRepository implements IWithholdingConceptRepository {
  async create(data: CreateWithholdingConceptData): Promise<WithholdingConceptRecord> {
    try {
      const row = await prisma.withholdingConcept.create({
        data: {
          companyId: getTenantContext().companyId,
          code: data.code,
          name: data.name,
          type: data.type,
          ratePercent: data.ratePercent,
          dianConceptCode: data.dianConceptCode,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe un concepto de retencion con el codigo ${data.code}`);
      }
      throw err;
    }
  }

  async list(): Promise<WithholdingConceptRecord[]> {
    const rows = await prisma.withholdingConcept.findMany({ orderBy: { code: "asc" } });
    return rows.map(this.toRecord);
  }

  async findByIdOrThrow(id: string): Promise<WithholdingConceptRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.withholdingConcept.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("WithholdingConcept", id);
    return this.toRecord(row);
  }

  async update(id: string, data: UpdateWithholdingConceptData): Promise<WithholdingConceptRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.withholdingConcept.update({
      where: { id },
      data: { name: data.name, ratePercent: data.ratePercent, dianConceptCode: data.dianConceptCode },
    });
    return this.toRecord(row);
  }

  async deactivate(id: string): Promise<WithholdingConceptRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.withholdingConcept.update({ where: { id }, data: { isActive: false } });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    code: string;
    name: string;
    type: string;
    ratePercent: Prisma.Decimal;
    isActive: boolean;
    dianConceptCode: string | null;
  }): WithholdingConceptRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type as WithholdingType,
      ratePercent: Number(row.ratePercent),
      isActive: row.isActive,
      dianConceptCode: row.dianConceptCode,
    };
  }
}
