import { ConflictError } from "../../../../shared/errors/app-error";
import { hashSecret } from "../../../auth/infrastructure/password-hasher.service";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserDirectoryRepository, UserSummary } from "../../domain/rbac.types";

export interface CreateUserUseCaseInput {
  email: string;
  fullName: string;
  password: string;
  roleId?: string;
}

export class CreateUserUseCase {
  constructor(private readonly userDirectoryRepo: IUserDirectoryRepository, private readonly audit: AuditService) {}

  async execute(input: CreateUserUseCaseInput): Promise<UserSummary> {
    if (await this.userDirectoryRepo.emailExists(input.email)) {
      throw new ConflictError(`Ya existe un usuario con el correo ${input.email}`);
    }

    const passwordHash = await hashSecret(input.password);
    const user = await this.userDirectoryRepo.create({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      roleId: input.roleId,
    });

    await this.audit.record({
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      description: `Usuario creado: ${user.fullName} (${user.email})`,
    });

    return user;
  }
}
