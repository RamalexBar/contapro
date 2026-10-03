import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type {
  CreateExternalShiftCloseData,
  ExternalShiftCloseRecord,
  IExternalShiftCloseRepository,
  UpdateExternalShiftCloseData,
} from "../domain/external-shift-close.repository";

function toRecord(row: {
  id: string;
  companyId: string;
  branchId: string;
  externalReference: string;
  status: string;
  journalEntryIds: string[];
  journalEntryNumbers: number[];
  errorMessage: string | null;
  createdAt: Date;
}): ExternalShiftCloseRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    externalReference: row.externalReference,
    status: row.status as "POSTED" | "FAILED",
    journalEntryIds: row.journalEntryIds,
    journalEntryNumbers: row.journalEntryNumbers,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

export class PrismaExternalShiftCloseRepository implements IExternalShiftCloseRepository {
  async create(data: CreateExternalShiftCloseData): Promise<ExternalShiftCloseRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.externalShiftClose.create({
      data: {
        id: data.id,
        companyId,
        branchId: data.branchId,
        externalReference: data.externalReference,
        status: data.status,
        journalEntryIds: data.journalEntryIds,
        journalEntryNumbers: data.journalEntryNumbers,
        errorMessage: data.errorMessage ?? null,
      },
    });
    return toRecord(row);
  }

  async update(id: string, data: UpdateExternalShiftCloseData): Promise<ExternalShiftCloseRecord> {
    // findFirst + update por id (no updateMany): CLAUDE.md -- update por id NO queda cubierto por
    // la extension de tenant, hay que confirmar pertenencia al tenant primero.
    const companyId = getTenantContext().companyId;
    const existing = await prisma.externalShiftClose.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error(`ExternalShiftClose ${id} no encontrado`);
    const row = await prisma.externalShiftClose.update({
      where: { id },
      data: {
        status: data.status,
        journalEntryIds: data.journalEntryIds,
        journalEntryNumbers: data.journalEntryNumbers,
        errorMessage: data.errorMessage ?? null,
      },
    });
    return toRecord(row);
  }

  async findByExternalReference(externalReference: string): Promise<ExternalShiftCloseRecord | null> {
    // findFirst, NO findUnique por [companyId, externalReference]: el extension de tenant ya
    // inyecta companyId en findFirst -- mismo criterio documentado en CLAUDE.md (findUnique por
    // id/clave compuesta NO queda cubierto automaticamente por la extension).
    const row = await prisma.externalShiftClose.findFirst({ where: { externalReference } });
    return row ? toRecord(row) : null;
  }

  async list(filter?: { take?: number; skip?: number }): Promise<ExternalShiftCloseRecord[]> {
    const rows = await prisma.externalShiftClose.findMany({
      orderBy: { createdAt: "desc" },
      take: filter?.take,
      skip: filter?.skip,
    });
    return rows.map(toRecord);
  }
}
