import type { RegisterCompanyInput } from "@erp/shared-types";
import type { IUserRepository } from "../../domain/user.repository";
import { hashSecret } from "../../infrastructure/password-hasher.service";
import { ConflictError } from "../../../../shared/errors/app-error";
import { basePrisma } from "@erp/database";

export class RegisterCompanyUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: RegisterCompanyInput): Promise<{ companyId: string; branchId: string; adminUserId: string }> {
    const existing = await basePrisma.company.findUnique({ where: { nit: input.nit } });
    if (existing) {
      throw new ConflictError(`Ya existe una empresa registrada con NIT ${input.nit}`);
    }

    const adminPasswordHash = await hashSecret(input.adminPassword);

    return this.userRepo.createCompanyWithAdmin({
      companyName: input.companyName,
      legalName: input.legalName,
      nit: input.nit,
      companyEmail: input.companyEmail,
      branchName: input.branchName,
      adminFullName: input.adminFullName,
      adminEmail: input.adminEmail,
      adminPasswordHash,
    });
  }
}
