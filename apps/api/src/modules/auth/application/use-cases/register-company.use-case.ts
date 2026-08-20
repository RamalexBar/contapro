import type { RegisterCompanyInput } from "@erp/shared-types";
import type { IUserRepository } from "../../domain/user.repository";
import { hashSecret } from "../../infrastructure/password-hasher.service";
import { ConflictError } from "../../../../shared/errors/app-error";
import { basePrisma, seedDefaultChartOfAccounts, seedDefaultExpenseCategories, seedDefaultWithholdingConcepts } from "@erp/database";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";

/** Codigo del plan de prueba asignado automaticamente al registrar una empresa -- debe existir
 * en la tabla Plan (ver seed.ts). Si no existe, el registro sigue funcionando igual (la empresa
 * queda sin suscripcion, recuperable a mano desde el panel admin) en vez de bloquear el alta. */
const TRIAL_PLAN_CODE = "TRIAL";
/** 14 dias: el spec original no especifica la duracion exacta del periodo de prueba -- valor
 * asumido, documentado aqui para poder ajustarlo sin buscar en todo el codigo. */
const TRIAL_PERIOD_DAYS = 14;

export class RegisterCompanyUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly planRepo: IPlanRepository,
    private readonly subscriptionRepo: ISubscriptionRepository
  ) {}

  async execute(input: RegisterCompanyInput): Promise<{ companyId: string; branchId: string; adminUserId: string }> {
    const existing = await basePrisma.company.findUnique({ where: { nit: input.nit } });
    if (existing) {
      throw new ConflictError(`Ya existe una empresa registrada con NIT ${input.nit}`);
    }

    const adminPasswordHash = await hashSecret(input.adminPassword);

    const result = await this.userRepo.createCompanyWithAdmin({
      companyName: input.companyName,
      legalName: input.legalName,
      nit: input.nit,
      companyEmail: input.companyEmail,
      branchName: input.branchName,
      adminFullName: input.adminFullName,
      adminEmail: input.adminEmail,
      adminPasswordHash,
    });

    // A diferencia de la suscripcion de prueba (mas abajo, tolerante a que el plan no exista
    // todavia), esto es un simple upsert sin dependencias externas -- si falla, algo mas grave
    // esta roto (DB caida) y el registro deberia fallar tambien. Si una empresa queda sin estos
    // conceptos por alguna otra razon, el backfill de seedBase() los completa despues.
    await seedDefaultWithholdingConcepts(basePrisma, result.companyId);
    await seedDefaultExpenseCategories(basePrisma, result.companyId);
    await seedDefaultChartOfAccounts(basePrisma, result.companyId);

    const trialPlan = await this.planRepo.findByCode(TRIAL_PLAN_CODE);
    if (trialPlan) {
      const startDate = new Date();
      const currentPeriodEnd = new Date(startDate);
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + TRIAL_PERIOD_DAYS);

      await this.subscriptionRepo.create({
        companyId: result.companyId,
        planId: trialPlan.id,
        status: "TRIALING",
        billingCycle: "MONTHLY",
        startDate,
        currentPeriodEnd,
      });
    }

    return result;
  }
}
