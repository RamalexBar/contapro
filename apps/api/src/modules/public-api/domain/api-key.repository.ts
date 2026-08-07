export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface CreateApiKeyData {
  name: string;
  scopes: string[];
  createdByUserId: string;
  /** Ya calculados por el caso de uso -- el repositorio no genera ni hashea la key. */
  keyHash: string;
  keyPrefix: string;
}

/** Fila completa cross-tenant, resuelta por hash -- usada solo por el middleware de
 * autenticacion (no expone companyId a la capa de dominio de otros modulos). */
export interface ApiKeyWithCompany extends ApiKeyRecord {
  companyId: string;
}

export interface IApiKeyRepository {
  create(data: CreateApiKeyData): Promise<ApiKeyRecord>;
  list(): Promise<ApiKeyRecord[]>;
  findByIdOrThrow(id: string): Promise<ApiKeyRecord>;
  deactivate(id: string): Promise<ApiKeyRecord>;
  /** Sin scope de tenant (basePrisma) -- el middleware de autenticacion todavia no sabe a que
   * empresa pertenece la request, mismo criterio que
   * findPaymentByReferenceCrossTenant/findByReferenceCrossTenant en collections/saas-admin. */
  findByHashCrossTenant(keyHash: string): Promise<ApiKeyWithCompany | null>;
  touchLastUsed(id: string): Promise<void>;
}
