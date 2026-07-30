import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type {
  CreateNumberingResolutionData,
  IInvoiceNumberingResolutionRepository,
  NumberingResolutionRecord,
} from "../domain/invoice-numbering-resolution.repository";

function toRecord(row: {
  id: string;
  branchId: string | null;
  resolutionNumber: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  currentNumber: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
}): NumberingResolutionRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    resolutionNumber: row.resolutionNumber,
    prefix: row.prefix,
    rangeFrom: row.rangeFrom,
    rangeTo: row.rangeTo,
    currentNumber: row.currentNumber,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    isActive: row.isActive,
  };
}

export class PrismaInvoiceNumberingResolutionRepository implements IInvoiceNumberingResolutionRepository {
  async create(data: CreateNumberingResolutionData): Promise<NumberingResolutionRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.invoiceNumberingResolution.create({
      data: {
        companyId,
        branchId: data.branchId ?? null,
        resolutionNumber: data.resolutionNumber,
        prefix: data.prefix,
        rangeFrom: data.rangeFrom,
        rangeTo: data.rangeTo,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
      },
    });
    return toRecord(row);
  }

  async list(): Promise<NumberingResolutionRecord[]> {
    const rows = await prisma.invoiceNumberingResolution.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }
}
