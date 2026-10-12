import type { UpdateBranchInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";
import type { BranchRecord, IBranchRepository } from "../../domain/branch.repository";

/**
 * Editar datos de una sucursal, desactivarla o reactivarla. La principal no se desactiva (es donde
 * caen los usuarios que se quedan sin sucursal). Desactivar exige la caja cerrada, y reactivar
 * cuenta contra el limite de sucursales del plan, igual que crear.
 */
export class UpdateBranchUseCase {
  constructor(
    private readonly branchRepo: IBranchRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository,
    private readonly audit: AuditService
  ) {}

  async execute(id: string, input: UpdateBranchInput): Promise<BranchRecord> {
    const { companyId } = getTenantContext();
    const branch = await this.branchRepo.findById(companyId, id);
    if (!branch) throw new NotFoundError("Branch", id);

    const { isActive, ...details } = input;
    let result = branch;
    const changes: string[] = [];

    if (Object.keys(details).length > 0) {
      result = await this.branchRepo.update(companyId, id, details);
      changes.push("datos actualizados");
    }

    if (isActive === false && branch.isActive) {
      if (branch.isMain) throw new ValidationError("La sucursal principal no se puede desactivar");
      if (getTenantContext().branchId === id) {
        throw new ValidationError(`Estas trabajando en ${branch.name}. Cambia a otra sucursal desde la barra de arriba antes de desactivarla`);
      }
      if (await this.branchRepo.hasOpenCashSession(id)) {
        throw new ValidationError(`Cierra la caja de ${branch.name} antes de desactivarla`);
      }
      result = await this.branchRepo.deactivate(companyId, id);
      changes.push("desactivada (sus usuarios pasan a la principal)");
    }

    if (isActive === true && !branch.isActive) {
      const subscription = await this.subscriptionRepo.findActiveByCompanyId(companyId);
      if (!subscription) throw new ValidationError("La empresa no tiene una suscripcion activa");
      const plan = await this.planRepo.findByIdOrThrow(subscription.planId);
      if ((await this.branchRepo.countActive(companyId)) >= plan.maxBranches) {
        throw new ValidationError(
          `Tu plan (${plan.name}) permite hasta ${plan.maxBranches} sucursal${plan.maxBranches === 1 ? "" : "es"} activas. ` +
            `Desactiva otra o actualiza tu plan desde "Mi suscripcion".`
        );
      }
      result = await this.branchRepo.reactivate(companyId, id);
      changes.push("reactivada");
    }

    if (changes.length > 0) {
      await this.audit.record({
        action: "BRANCH_UPDATED",
        entityType: "Branch",
        entityId: id,
        description: `Sucursal ${result.name}: ${changes.join(", ")}`,
      });
    }

    return result;
  }
}
