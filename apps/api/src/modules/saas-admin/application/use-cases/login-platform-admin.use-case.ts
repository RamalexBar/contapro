import { UnauthorizedError } from "../../../../shared/errors/app-error";
import { verifySecret } from "../../../auth/infrastructure/password-hasher.service";
import type { IPlatformAdminRepository } from "../../domain/platform-admin.repository";
import { signPlatformAdminToken } from "../../infrastructure/platform-admin-jwt.service";

export interface LoginPlatformAdminInput {
  email: string;
  password: string;
}

export interface LoginPlatformAdminOutput {
  accessToken: string;
  platformAdmin: { id: string; email: string; fullName: string };
}

export class LoginPlatformAdminUseCase {
  constructor(private readonly repo: IPlatformAdminRepository) {}

  async execute(input: LoginPlatformAdminInput): Promise<LoginPlatformAdminOutput> {
    const admin = await this.repo.findByEmail(input.email);
    if (!admin || !admin.isActive) {
      throw new UnauthorizedError("Credenciales invalidas");
    }

    const validPassword = await verifySecret(input.password, admin.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedError("Credenciales invalidas");
    }

    const accessToken = signPlatformAdminToken({ sub: admin.id });
    return { accessToken, platformAdmin: { id: admin.id, email: admin.email, fullName: admin.fullName } };
  }
}
