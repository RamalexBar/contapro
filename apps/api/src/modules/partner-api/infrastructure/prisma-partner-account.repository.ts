import { basePrisma, seedDefaultChartOfAccounts, seedDefaultExpenseCategories, seedDefaultWithholdingConcepts } from "@erp/database";
import { PrismaUserRepository } from "../../auth/infrastructure/prisma-user.repository";
import type {
  IPartnerAccountRepository,
  IssuePartnerApiKeyData,
  NewPartnerCompanyData,
  Partner,
  PartnerAccountRecord,
  PartnerPlanDefinition,
} from "../domain/partner-account.repository";

const toRecord = (row: { id: string; partner: string; externalId: string; companyId: string; apiKeyId: string | null }): PartnerAccountRecord => ({
  id: row.id,
  partner: row.partner as Partner,
  externalId: row.externalId,
  companyId: row.companyId,
  apiKeyId: row.apiKeyId,
});

/**
 * basePrisma (sin tenant) a proposito: la llamada del aliado no viene de ningun usuario de empresa
 * -- mismo criterio que PrismaUserRepository para el registro publico. Cada consulta filtra por
 * companyId explicito.
 */
export class PrismaPartnerAccountRepository implements IPartnerAccountRepository {
  private readonly userRepo = new PrismaUserRepository();

  async findByExternalId(partner: Partner, externalId: string) {
    const row = await basePrisma.partnerAccount.findUnique({ where: { partner_externalId: { partner, externalId } } });
    return row ? toRecord(row) : null;
  }

  async findCompanyIdByNit(nit: string) {
    const row = await basePrisma.company.findUnique({ where: { nit }, select: { id: true } });
    return row?.id ?? null;
  }

  async findUserIdByEmail(companyId: string, email: string) {
    const row = await basePrisma.user.findFirst({
      where: { companyId, email: { equals: email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async findAdminUserId(companyId: string) {
    const row = await basePrisma.user.findFirst({
      where: { companyId, isActive: true, roles: { some: { role: { name: { in: ["ADMINISTRADOR", "PROPIETARIO"] } } } } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async createCompany(data: NewPartnerCompanyData) {
    const result = await this.userRepo.createCompanyWithAdmin({
      companyName: data.companyName,
      legalName: data.legalName,
      nit: data.nit,
      companyEmail: data.companyEmail,
      branchName: "Principal",
      adminFullName: data.adminFullName,
      adminEmail: data.adminEmail,
      adminPasswordHash: data.adminPasswordHash,
    });
    await basePrisma.company.update({
      where: { id: result.companyId },
      data: {
        documentType: data.documentType,
        dv: data.dv,
        phone: data.phone,
        whatsapp: data.phone,
        address: data.address,
        municipality: data.municipality,
      },
    });
    // Lo mismo que hace RegisterCompanyUseCase despues de crear la empresa.
    await seedDefaultWithholdingConcepts(basePrisma, result.companyId);
    await seedDefaultExpenseCategories(basePrisma, result.companyId);
    await seedDefaultChartOfAccounts(basePrisma, result.companyId);
    return { companyId: result.companyId, adminUserId: result.adminUserId };
  }

  async create(data: { partner: Partner; externalId: string; companyId: string }) {
    return toRecord(await basePrisma.partnerAccount.create({ data }));
  }

  async setApiKey(accountId: string, apiKeyId: string) {
    await basePrisma.partnerAccount.update({ where: { id: accountId }, data: { apiKeyId } });
  }

  async ensurePlan(plan: PartnerPlanDefinition) {
    const row = await basePrisma.plan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        priceMonthly: 0,
        priceYearly: 0,
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        maxElectronicDocumentsPerMonth: plan.maxElectronicDocumentsPerMonth,
        features: { billedBy: "CAJAPRO" },
      },
      update: {},
      select: { id: true },
    });
    return row.id;
  }

  async upsertPartnerSubscription(data: { companyId: string; planId: string; currentPeriodEnd: Date; billedBy: Partner }) {
    const latest = await basePrisma.subscription.findFirst({
      where: { companyId: data.companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const fields = {
      planId: data.planId,
      status: "ACTIVE" as const,
      billingCycle: "YEARLY",
      currentPeriodEnd: data.currentPeriodEnd,
      graceEndsAt: null,
      cancelledAt: null,
      billedBy: data.billedBy,
      // Si la empresa venia pagando con tarjeta en Contapro, no se le vuelve a cobrar aqui.
      autoRenew: false,
    };
    if (latest) {
      await basePrisma.subscription.update({ where: { id: latest.id }, data: fields });
    } else {
      await basePrisma.subscription.create({ data: { companyId: data.companyId, startDate: new Date(), ...fields } });
    }
  }

  async issueApiKey(data: IssuePartnerApiKeyData) {
    return basePrisma.$transaction(async (tx) => {
      if (data.revokeApiKeyId) {
        await tx.apiKey.updateMany({ where: { id: data.revokeApiKeyId, companyId: data.companyId }, data: { isActive: false } });
      }
      const row = await tx.apiKey.create({
        data: {
          companyId: data.companyId,
          name: data.name,
          scopes: data.scopes,
          keyHash: data.keyHash,
          keyPrefix: data.keyPrefix,
          createdByUserId: data.createdByUserId,
        },
        select: { id: true },
      });
      return row.id;
    });
  }

  async listBranches(companyId: string) {
    return basePrisma.branch.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    });
  }
}
