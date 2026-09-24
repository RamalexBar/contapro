import type { AuditService } from "../../../audit/application/audit.service";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ISubscriptionRepository } from "../../domain/subscription.repository";
import type { FactusActivationAttachment, IFactusActivationNotifier } from "../../domain/factus-activation-notifier";

export interface SendFactusActivationRequestInput {
  companyId: string;
  platformAdminId: string;
  integrationVersion: "v1" | "v2";
  rut: FactusActivationAttachment;
  legalRepCertificate: FactusActivationAttachment | null;
  legalRepId: FactusActivationAttachment;
  purchaseProof: FactusActivationAttachment;
  logo: FactusActivationAttachment;
}

/**
 * Herramienta interna del panel de plataforma (no autoservicio del cliente, ver
 * modules/saas-admin/README.md) -- un operador de Contapro recibe los 5 documentos de activacion
 * de un cliente (RUT, certificado de representacion legal, cedula, comprobante de compra, logo)
 * por fuera del sistema (WhatsApp/correo) y los carga aca para reenviarlos a Factus
 * (activacion@factus.com.co) sin tener que armar el correo a mano cada vez. No persiste los
 * archivos: se adjuntan al correo y se descartan (ver IFactusActivationNotifier) -- por eso no
 * hace falta resolver infraestructura de storage (Supabase) para esto.
 */
export class SendFactusActivationRequestUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly notifier: IFactusActivationNotifier,
    private readonly audit: AuditService
  ) {}

  async execute(input: SendFactusActivationRequestInput): Promise<void> {
    const companies = await this.subscriptionRepo.listCompaniesWithSubscription();
    const company = companies.find((c) => c.companyId === input.companyId);
    if (!company) throw new NotFoundError("Company", input.companyId);

    await this.notifier.send({
      companyName: company.companyName,
      nit: company.nit,
      integrationVersion: input.integrationVersion,
      rut: input.rut,
      legalRepCertificate: input.legalRepCertificate,
      legalRepId: input.legalRepId,
      purchaseProof: input.purchaseProof,
      logo: input.logo,
    });

    await this.audit.recordWithoutContext(input.companyId, input.platformAdminId, {
      action: "FACTUS_ACTIVATION_REQUEST_SENT",
      entityType: "Company",
      entityId: input.companyId,
      description: `Solicitud de activacion Factus enviada a activacion@factus.com.co para ${company.companyName} (NIT ${company.nit}, integracion ${input.integrationVersion})`,
    });
  }
}
