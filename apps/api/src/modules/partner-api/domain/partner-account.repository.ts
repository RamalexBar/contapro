/** Aliados que venden Contapro dentro de su propio paquete. Hoy solo Cajapro (plan "Anual con Contapro"). */
export type Partner = "CAJAPRO";

export interface PartnerAccountRecord {
  id: string;
  partner: Partner;
  externalId: string;
  companyId: string;
  apiKeyId: string | null;
}

export interface NewPartnerCompanyData {
  companyName: string;
  legalName: string;
  nit: string;
  dv: string | null;
  documentType: "NIT" | "CC";
  companyEmail: string;
  phone: string | null;
  address: string | null;
  municipality: string | null;
  adminFullName: string;
  adminEmail: string;
  adminPasswordHash: string;
}

export interface PartnerPlanDefinition {
  code: string;
  name: string;
  maxBranches: number;
  maxUsers: number;
  maxElectronicDocumentsPerMonth: number;
}

export interface IssuePartnerApiKeyData {
  companyId: string;
  createdByUserId: string;
  name: string;
  scopes: string[];
  keyHash: string;
  keyPrefix: string;
  /** La key anterior entregada al aliado, que se revoca en la misma operacion. */
  revokeApiKeyId: string | null;
}

/**
 * Todo lo que necesita el alta de una empresa desde un aliado. Va sin tenant (basePrisma): la
 * llamada del aliado no pertenece a ninguna empresa todavia, igual que el registro publico.
 */
export interface IPartnerAccountRepository {
  findByExternalId(partner: Partner, externalId: string): Promise<PartnerAccountRecord | null>;
  findCompanyIdByNit(nit: string): Promise<string | null>;
  /** Id de un usuario activo de la empresa con ese correo, o null. */
  findUserIdByEmail(companyId: string, email: string): Promise<string | null>;
  /** Primer usuario administrador de la empresa (dueño de la API key que se le entrega al aliado). */
  findAdminUserId(companyId: string): Promise<string | null>;
  /** Empresa + sede principal + administrador + caja, y el plan de cuentas, retenciones y
   * categorias de gasto por defecto -- lo mismo que deja el registro publico. */
  createCompany(data: NewPartnerCompanyData): Promise<{ companyId: string; adminUserId: string }>;
  create(data: { partner: Partner; externalId: string; companyId: string }): Promise<PartnerAccountRecord>;
  setApiKey(accountId: string, apiKeyId: string): Promise<void>;
  /** Crea el plan si no existe (no se siembra en produccion) y devuelve su id. */
  ensurePlan(plan: PartnerPlanDefinition): Promise<string>;
  /** Deja la suscripcion mas reciente de la empresa (o una nueva) en ese plan, ACTIVA hasta
   * `currentPeriodEnd`, cobrada por el aliado y sin cobro automatico propio de Contapro. */
  upsertPartnerSubscription(data: { companyId: string; planId: string; currentPeriodEnd: Date; billedBy: Partner }): Promise<void>;
  issueApiKey(data: IssuePartnerApiKeyData): Promise<string>;
  listBranches(companyId: string): Promise<{ id: string; name: string }[]>;
}
