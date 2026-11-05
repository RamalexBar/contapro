import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { IOperationalAlerts } from "../../../../shared/alerts/operational-alerts";
import type { IObjectStorage } from "../../../../shared/storage/object-storage";
import type { AuditService } from "../../../audit/application/audit.service";
import { CompanyDeleteError, type ICompanyAdminRepository } from "../../domain/company-admin.repository";

/**
 * Archivar (o reactivar) una empresa: nadie entra (usuarios, enlace de Cajapro ni API keys), no se le cobra ni se le
 * mandan recordatorios y sale de la lista del panel. No se borra nada ni se toca su suscripcion, asi que al
 * reactivarla queda exactamente como estaba.
 */
export class SetCompanyArchivedUseCase {
  constructor(private readonly repo: ICompanyAdminRepository, private readonly audit: AuditService) {}

  async execute(input: { companyId: string; archived: boolean; platformAdminId: string }): Promise<void> {
    const company = await this.repo.findById(input.companyId);
    if (!company) throw new NotFoundError("Empresa");
    if (company.isActive === !input.archived) return;
    await this.repo.setActive(company.id, !input.archived);
    await this.audit.recordWithoutContext(company.id, null, {
      action: input.archived ? "COMPANY_ARCHIVED" : "COMPANY_REACTIVATED",
      entityType: "Company",
      entityId: company.id,
      description: `${input.archived ? "Archivada" : "Reactivada"} desde el panel de plataforma (admin ${input.platformAdminId})`,
    });
  }
}

/**
 * Borrar definitivamente: solo una empresa ya archivada y escribiendo su nombre exacto. Se borra con todo lo suyo, su
 * auditoria incluida, asi que el registro de quien la borro queda en el correo de avisos del equipo.
 */
export class DeleteCompanyUseCase {
  constructor(
    private readonly repo: ICompanyAdminRepository,
    private readonly alerts: IOperationalAlerts,
    private readonly storage: IObjectStorage | null = null
  ) {}

  async execute(input: { companyId: string; confirmName: string; platformAdminId: string }): Promise<{ deleted: number }> {
    const company = await this.repo.findById(input.companyId);
    if (!company) throw new NotFoundError("Empresa");
    if (company.isActive) throw new ConflictError("Primero archive la empresa; despues se puede borrar");
    if (input.confirmName.trim() !== company.name.trim()) throw new ValidationError("El nombre no coincide: escribalo exactamente como aparece");

    // Las llaves se leen antes: despues del borrado ya no queda la fila que dice donde esta cada archivo
    const fileKeys = this.storage ? await this.repo.listStoredFileKeys(company.id) : [];
    let result: { deleted: number };
    try {
      result = await this.repo.deleteCompletely(company.id);
    } catch (err) {
      if (err instanceof CompanyDeleteError) throw new ConflictError(err.message);
      throw err;
    }
    // Despues de borrar la base: si algun archivo no se puede borrar queda huerfano en R2 (no se ve en ningun lado)
    let filesNotDeleted = 0;
    for (const key of fileKeys) {
      await this.storage!.delete(key).catch(() => filesNotDeleted++);
    }
    this.alerts.send(
      `company-deleted:${company.id}`,
      `Empresa borrada: ${company.name}`,
      `El admin de plataforma ${input.platformAdminId} borro definitivamente la empresa «${company.name}» (${company.id}): ${result.deleted} registros.` +
        (company.partner ? ` Venia del combo de ${company.partner}: si alla se renueva, se vuelve a crear.` : "") +
        (fileKeys.length ? ` Fotos en R2: ${fileKeys.length - filesNotDeleted} borradas${filesNotDeleted ? `, ${filesNotDeleted} no se pudieron borrar` : ""}.` : "")
    );
    return result;
  }
}
