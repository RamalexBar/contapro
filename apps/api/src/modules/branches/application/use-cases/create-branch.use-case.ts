import type { CreateBranchInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ConflictError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";
import type { BranchRecord, IBranchRepository } from "../../domain/branch.repository";

function slugifyCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar tildes
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return base || "SUC";
}

/**
 * Antes de esto, `maxBranches` (Plan, ver tenant.prisma) era un dato puramente decorativo -- se
 * mostraba en el panel de planes y en "Mi suscripcion" ("Hasta N sucursales") pero nada lo
 * verificaba nunca, porque no existia ninguna forma de crear una sucursal fuera de la que se crea
 * automaticamente al registrar la empresa (ver RegisterCompanyUseCase). Este es el primer lugar
 * que realmente lo hace cumplir.
 */
export class CreateBranchUseCase {
  constructor(
    private readonly branchRepo: IBranchRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateBranchInput): Promise<BranchRecord> {
    const { companyId } = getTenantContext();

    const subscription = await this.subscriptionRepo.findActiveByCompanyId(companyId);
    if (!subscription) {
      throw new ValidationError("La empresa no tiene una suscripcion activa -- no se pueden crear sucursales.");
    }
    const plan = await this.planRepo.findByIdOrThrow(subscription.planId);

    const currentCount = await this.branchRepo.countActive(companyId);
    if (currentCount >= plan.maxBranches) {
      throw new ValidationError(
        `Tu plan (${plan.name}) permite hasta ${plan.maxBranches} sucursal${plan.maxBranches === 1 ? "" : "es"}. ` +
          `Actualiza tu plan desde "Mi suscripcion" para agregar mas.`
      );
    }

    // El codigo nunca lo pide el usuario (es un detalle tecnico, no de negocio) -- se deriva del
    // nombre y, si choca con uno existente en la misma empresa (@@unique([companyId, code])), se
    // le agrega un sufijo numerico hasta encontrar uno libre.
    const base = slugifyCode(input.name);
    let code = base;
    let suffix = 2;
    while (await this.branchRepo.existsByCode(companyId, code)) {
      code = `${base}${suffix}`;
      suffix += 1;
      if (suffix > 50) throw new ConflictError("No se pudo generar un codigo unico para la sucursal");
    }

    const branch = await this.branchRepo.create(companyId, {
      name: input.name,
      code,
      address: input.address,
      phone: input.phone,
    });

    await this.audit.record({
      action: "BRANCH_CREATED",
      entityType: "Branch",
      entityId: branch.id,
      description: `Sucursal creada: ${branch.name} (${branch.code})`,
    });

    return branch;
  }
}
