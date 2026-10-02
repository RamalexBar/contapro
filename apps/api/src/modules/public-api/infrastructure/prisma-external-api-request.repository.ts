import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { Prisma } from "@erp/database";
import type {
  CreateExternalApiRequestData,
  ExternalApiRequestRecord,
  IExternalApiRequestRepository,
  UpdateExternalApiRequestData,
} from "../domain/external-api-request.repository";

function toRecord(row: {
  id: string;
  endpoint: string;
  externalReference: string;
  status: string;
  responseBody: Prisma.JsonValue;
  errorMessage: string | null;
  createdAt: Date;
}): ExternalApiRequestRecord {
  return {
    id: row.id,
    endpoint: row.endpoint,
    externalReference: row.externalReference,
    status: row.status as "POSTED" | "FAILED",
    responseBody: row.responseBody,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

export class PrismaExternalApiRequestRepository implements IExternalApiRequestRepository {
  async create(data: CreateExternalApiRequestData): Promise<ExternalApiRequestRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.externalApiRequest.create({
      data: {
        companyId,
        endpoint: data.endpoint,
        externalReference: data.externalReference,
        status: data.status,
        responseBody: (data.responseBody ?? null) as Prisma.InputJsonValue,
        errorMessage: data.errorMessage ?? null,
      },
    });
    return toRecord(row);
  }

  async update(id: string, data: UpdateExternalApiRequestData): Promise<ExternalApiRequestRecord> {
    // findFirst + update por id (no updateMany): ver CLAUDE.md -- update por id NO queda cubierto
    // por la extension de tenant, hay que confirmar pertenencia al tenant primero.
    const companyId = getTenantContext().companyId;
    const existing = await prisma.externalApiRequest.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error(`ExternalApiRequest ${id} no encontrado`);
    const row = await prisma.externalApiRequest.update({
      where: { id },
      data: {
        status: data.status,
        responseBody: (data.responseBody ?? null) as Prisma.InputJsonValue,
        errorMessage: data.errorMessage ?? null,
      },
    });
    return toRecord(row);
  }

  async findByReference(endpoint: string, externalReference: string): Promise<ExternalApiRequestRecord | null> {
    // findFirst, NO findUnique por la clave compuesta: la extension de tenant ya inyecta
    // companyId en findFirst (mismo criterio que PrismaExternalShiftCloseRepository).
    const row = await prisma.externalApiRequest.findFirst({ where: { endpoint, externalReference } });
    return row ? toRecord(row) : null;
  }
}
