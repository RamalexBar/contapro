import { createHash, randomBytes } from "node:crypto";
import { ConflictError } from "../../../../shared/errors/app-error";
import { hashSecret } from "../../../auth/infrastructure/password-hasher.service";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPartnerAccountRepository, Partner, PartnerPlanDefinition } from "../../domain/partner-account.repository";

/** Tamaño del Contapro que trae cada plan de Cajapro (lo escoge el proveedor en Cajapro → Planes). */
export type CajaproComboTier = "EMPRENDEDOR" | "PYME" | "PLUS";

/** Los planes de Contapro que trae el combo de Cajapro: los mismos limites de los planes propios
 * (Emprendedor, Pyme, Plus), pero sin precio -- los cobra Cajapro. El codigo de todos empieza por
 * `COMBO_CAJAPRO` (el Emprendedor conserva el codigo original, que ya tienen las empresas creadas). */
export const CAJAPRO_COMBO_PLANS: Record<CajaproComboTier, PartnerPlanDefinition> = {
  EMPRENDEDOR: { code: "COMBO_CAJAPRO", name: "Combo Cajapro Emprendedor", maxBranches: 1, maxUsers: 3, maxElectronicDocumentsPerMonth: 150 },
  PYME: { code: "COMBO_CAJAPRO_PYME", name: "Combo Cajapro Pyme", maxBranches: 3, maxUsers: 10, maxElectronicDocumentsPerMonth: 350 },
  PLUS: { code: "COMBO_CAJAPRO_PLUS", name: "Combo Cajapro Plus", maxBranches: 10, maxUsers: 50, maxElectronicDocumentsPerMonth: 650 },
};

/** Todos los planes del combo empiezan asi: se cobran en Cajapro, nunca en Contapro. */
export const isCajaproComboPlan = (code: string) => code.startsWith("COMBO_CAJAPRO");

/** Lo que Cajapro usa de la API publica: facturas, cierres de turno, compras, pagos a proveedores
 * y gastos (ver modules/public-api/README.md, "Conexion con Cajapro"). */
export const CAJAPRO_API_KEY_SCOPES = ["sale.read", "sale.create", "accounting.read", "accounting.manage", "suppliers.manage", "expense.manage"];

const KEY_PREFIX = "pk_live_";

export interface ProvisionPartnerAccountInput {
  partner: Partner;
  externalId: string;
  company: {
    name: string;
    legalName: string;
    nit: string;
    dv?: string | null;
    documentType: "NIT" | "CC";
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
  };
  owner: { fullName: string; email: string };
  /** Hasta cuando esta pagado el paquete en el sistema del aliado (o hasta cuando va su prueba gratis). */
  paidUntil: Date;
  /** Prueba gratis del paquete: la empresa queda en TRIALING hasta `paidUntil` y vence sola si no paga. */
  trial?: boolean;
  /** Tamaño del Contapro segun el plan de Cajapro (por defecto Emprendedor). */
  tier?: CajaproComboTier;
  /** Pedir una API key nueva (la anterior se revoca). Una cuenta nueva siempre recibe una. */
  issueApiKey: boolean;
}

export interface ProvisionPartnerAccountResult {
  companyId: string;
  /** true = se creo ahora; false = ya existia (renovacion, o la empresa ya estaba en Contapro). */
  created: boolean;
  adminEmail: string;
  /** Solo cuando se creo el usuario: el aliado se la muestra al dueño una vez. */
  temporaryPassword: string | null;
  /** Solo cuando se emitio una key nueva -- nunca se vuelve a poder leer. */
  apiKey: string | null;
  branches: { id: string; name: string }[];
  paidUntil: Date;
}

/** Contraseña temporal legible (sin letras que se confunden), ej. "Kp7m-Xq3r-8dTw". */
function temporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const pick = (n: number) => Array.from(randomBytes(n), (b) => chars[b % chars.length]).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

/**
 * Alta (o renovacion) de una empresa vendida por un aliado. Idempotente por (aliado, id externo):
 * el aliado la llama al aprobarse cada pago del paquete y solo se corre la fecha de vencimiento.
 *
 * Si el NIT ya existe en Contapro (el cliente se habia registrado por su cuenta), se adopta esa
 * empresa solo si el correo del dueño es un usuario de ella -- si no, cualquiera que conociera un
 * NIT podria quedarse con una API key de una empresa ajena.
 */
export class ProvisionPartnerAccountUseCase {
  constructor(private readonly repo: IPartnerAccountRepository, private readonly audit: AuditService) {}

  async execute(input: ProvisionPartnerAccountInput): Promise<ProvisionPartnerAccountResult> {
    const adminEmail = input.owner.email.trim().toLowerCase();
    let account = await this.repo.findByExternalId(input.partner, input.externalId);
    let created = false;
    let password: string | null = null;
    let adminUserId: string | null = null;

    if (!account) {
      let companyId = await this.repo.findCompanyIdByNit(input.company.nit);
      if (companyId) {
        adminUserId = await this.repo.findUserIdByEmail(companyId, adminEmail);
        if (!adminUserId) {
          throw new ConflictError(
            `Ya existe una empresa con NIT ${input.company.nit} en Contapro y ${adminEmail} no es usuario de ella. Se debe revisar a mano.`
          );
        }
      } else {
        password = temporaryPassword();
        const result = await this.repo.createCompany({
          companyName: input.company.name,
          legalName: input.company.legalName,
          nit: input.company.nit,
          dv: input.company.dv ?? null,
          documentType: input.company.documentType,
          companyEmail: input.company.email.trim().toLowerCase(),
          phone: input.company.phone ?? null,
          address: input.company.address ?? null,
          municipality: input.company.city ?? null,
          adminFullName: input.owner.fullName,
          adminEmail,
          adminPasswordHash: await hashSecret(password),
        });
        companyId = result.companyId;
        adminUserId = result.adminUserId;
        created = true;
      }
      account = await this.repo.create({ partner: input.partner, externalId: input.externalId, companyId });
    }

    const planId = await this.repo.ensurePlan(CAJAPRO_COMBO_PLANS[input.tier ?? "EMPRENDEDOR"]);
    // Una prueba nunca pisa un plan pagado (el propio de Contapro o el combo ya pagado): solo conecta.
    const latest = input.trial ? await this.repo.findLatestSubscription(account.companyId) : null;
    const paying = !!latest && ["ACTIVE", "GRACE_PERIOD"].includes(latest.status) && latest.planCode !== "TRIAL";
    if (!paying) {
      await this.repo.upsertPartnerSubscription({
        companyId: account.companyId,
        planId,
        currentPeriodEnd: input.paidUntil,
        billedBy: input.partner,
        status: input.trial ? "TRIALING" : "ACTIVE",
      });
    }

    let apiKey: string | null = null;
    if (input.issueApiKey || !account.apiKeyId) {
      const ownerId = adminUserId ?? (await this.repo.findAdminUserId(account.companyId));
      if (!ownerId) throw new ConflictError("La empresa no tiene un usuario administrador para emitir la API key");
      apiKey = KEY_PREFIX + randomBytes(24).toString("hex");
      const apiKeyId = await this.repo.issueApiKey({
        companyId: account.companyId,
        createdByUserId: ownerId,
        name: "Cajapro (conexion automatica)",
        scopes: CAJAPRO_API_KEY_SCOPES,
        keyHash: createHash("sha256").update(apiKey).digest("hex"),
        keyPrefix: apiKey.slice(0, KEY_PREFIX.length + 6),
        revokeApiKeyId: account.apiKeyId,
      });
      await this.repo.setApiKey(account.id, apiKeyId);
    }

    await this.audit.recordWithoutContext(account.companyId, null, {
      action: "PARTNER_ACCOUNT_PROVISIONED",
      entityType: "PartnerAccount",
      entityId: account.id,
      description: `${input.partner} ${created ? "creo la empresa" : input.trial ? "conecto la prueba" : "renovo el paquete"}: ${input.trial ? "prueba gratis" : "pagado"} hasta ${input.paidUntil.toISOString().slice(0, 10)}, ${CAJAPRO_COMBO_PLANS[input.tier ?? "EMPRENDEDOR"].name}${paying ? " (sin tocar su plan pagado)" : ""}${apiKey ? ", API key nueva" : ""}`,
    });

    return {
      companyId: account.companyId,
      created,
      adminEmail,
      temporaryPassword: password,
      apiKey,
      branches: await this.repo.listBranches(account.companyId),
      paidUntil: input.paidUntil,
    };
  }
}
