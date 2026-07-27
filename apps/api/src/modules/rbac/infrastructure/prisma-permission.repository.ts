import { basePrisma } from "@erp/database";
import type { IPermissionRepository, PermissionInfo } from "../domain/rbac.types";

/** Permission no tiene companyId (es un catalogo global), por eso usa basePrisma directamente. */
export class PrismaPermissionRepository implements IPermissionRepository {
  async listAll(): Promise<PermissionInfo[]> {
    return basePrisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] });
  }

  async findByCodes(codes: string[]): Promise<PermissionInfo[]> {
    return basePrisma.permission.findMany({ where: { code: { in: codes } } });
  }
}
