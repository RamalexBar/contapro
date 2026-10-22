import { hashSecret } from "../../../auth/infrastructure/password-hasher.service";
import type { IPlatformAdminRepository } from "../../domain/platform-admin.repository";

/**
 * Pone una contraseña nueva a un operador del panel (el propio o el de otro). Es la forma de
 * recuperar el acceso de alguien que la olvido, sin la Shell de Render: el panel no tiene
 * "olvide mi contraseña" por correo.
 */
export class SetPlatformAdminPasswordUseCase {
  constructor(private readonly repo: IPlatformAdminRepository) {}

  async execute(id: string, password: string): Promise<void> {
    await this.repo.setPasswordHash(id, await hashSecret(password));
  }
}
