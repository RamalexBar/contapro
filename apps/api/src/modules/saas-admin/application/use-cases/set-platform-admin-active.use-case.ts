import { ValidationError } from "../../../../shared/errors/app-error";
import type { IPlatformAdminRepository, PlatformAdminSummary } from "../../domain/platform-admin.repository";

/**
 * Activa o desactiva el acceso de un operador del panel (desactivado = no puede iniciar sesion;
 * no se borra). Un operador no puede desactivarse a si mismo, asi el panel nunca se queda sin
 * nadie que pueda entrar.
 */
export class SetPlatformAdminActiveUseCase {
  constructor(private readonly repo: IPlatformAdminRepository) {}

  async execute(input: { id: string; isActive: boolean; requestedBy: string }): Promise<PlatformAdminSummary> {
    if (!input.isActive && input.id === input.requestedBy) {
      throw new ValidationError("No puedes desactivar tu propio acceso");
    }
    return this.repo.setActive(input.id, input.isActive);
  }
}
