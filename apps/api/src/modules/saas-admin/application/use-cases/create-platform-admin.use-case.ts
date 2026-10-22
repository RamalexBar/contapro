import { ConflictError } from "../../../../shared/errors/app-error";
import { hashSecret } from "../../../auth/infrastructure/password-hasher.service";
import type { IPlatformAdminRepository, PlatformAdminSummary } from "../../domain/platform-admin.repository";

export interface CreatePlatformAdminInput {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Crea otro operador del panel de plataforma desde el propio panel (antes solo se podia con
 * prisma/create-platform-admin.ts en la Shell de Render). El nuevo operador tiene el mismo acceso
 * total que quien lo crea: PlatformAdmin no tiene roles.
 */
export class CreatePlatformAdminUseCase {
  constructor(private readonly repo: IPlatformAdminRepository) {}

  async execute(input: CreatePlatformAdminInput): Promise<PlatformAdminSummary> {
    const email = input.email.trim().toLowerCase();
    if (await this.repo.findByEmail(email)) {
      throw new ConflictError("Ya existe un administrador de la plataforma con ese correo");
    }
    return this.repo.create({ email, fullName: input.fullName.trim(), passwordHash: await hashSecret(input.password) });
  }
}
