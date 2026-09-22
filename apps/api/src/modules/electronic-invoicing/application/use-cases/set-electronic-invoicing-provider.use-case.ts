import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { encryptCredential } from "../../../../shared/crypto/credential-cipher";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { IFactusAccountProvisioner } from "../../domain/factus-account-provisioner";
import type { IInvoiceNumberingResolutionRepository } from "../../domain/invoice-numbering-resolution.repository";
import type { ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";

export interface FactusCredentialsInput {
  clientId: string;
  clientSecret: string;
  email: string;
  password: string;
}

export interface SetElectronicInvoicingProviderInput {
  provider: "DIRECT" | "FACTUS";
  /** Las 4 credenciales OAuth2 de Factus, en texto plano -- se empaquetan junto al
   * numbering_range_id (obtenido automaticamente, ver execute) y se cifran juntas aqui.
   * Requerido si provider === "FACTUS" y la empresa todavia no tiene credenciales cargadas. */
  factusCredentials?: FactusCredentialsInput;
}

/**
 * Carga/cambia el proveedor tecnologico DIAN de la empresa (ver README, seccion "Proveedor
 * tecnologico (Factus API)"). Las credenciales nunca se vuelven a devolver en texto plano una vez
 * cargadas -- mismo criterio que create-api-key.use-case.ts (modules/public-api) para las API
 * keys salientes de Contapro.
 *
 * Activar FACTUS es 100% automatico: el usuario solo carga las 4 credenciales OAuth2, este caso
 * de uso se encarga de (1) tomar la resolucion DIAN de factura de venta que Contapro ya tiene
 * registrada (InvoiceNumberingResolution), (2) crear ese mismo rango de numeracion en Factus por
 * API y quedarse con el `numbering_range_id` que devuelve, y (3) subir el logo de la empresa a
 * Factus si ya hay uno cargado (best-effort, no bloquea la activacion si falla). Ver aviso de
 * verificacion en domain/factus-account-provisioner.ts -- esta automatizacion sigue la
 * documentacion oficial de Factus pero no se pudo confirmar contra un servicio real (los dos
 * endpoints devuelven 500 en el sandbox compartido sin importar el request).
 *
 * **Regla de negocio (2026-09-21, ver memoria factus-pricing-and-caps)**: una empresa en el plan
 * `TRIAL` no puede activar FACTUS -- factura via el proveedor tecnologico consume la bolsa de
 * documentos que Contapro paga por adelantado, y un trial (14 dias gratis, sin tarjeta) no deberia
 * poder gastarla sin ser cliente de pago. El plan TRIAL sigue pudiendo facturar por el camino
 * DIRECT (gratis, generado localmente) sin ninguna restriccion.
 */
export class SetElectronicInvoicingProviderUseCase {
  constructor(
    private readonly companyReader: ICompanyReader,
    private readonly audit: AuditService,
    private readonly numberingResolutionRepo: IInvoiceNumberingResolutionRepository,
    private readonly factusProvisioner: IFactusAccountProvisioner,
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository
  ) {}

  async execute(input: SetElectronicInvoicingProviderInput): Promise<void> {
    const companyId = getTenantContext().companyId;

    if (input.provider === "FACTUS") {
      if (!env.CREDENTIALS_ENCRYPTION_KEY) {
        throw new ValidationError("CREDENTIALS_ENCRYPTION_KEY no esta configurado en el servidor");
      }
      await this.assertNotOnTrialPlan(companyId);
      if (!input.factusCredentials) {
        const company = await this.companyReader.findByIdOrThrow(companyId);
        if (!company.factusCredentialsEncrypted) {
          throw new ValidationError("Se requieren las credenciales de Factus para activar ese proveedor");
        }
        // Cambio a FACTUS reusando credenciales (y rango de numeracion) ya provisionados antes --
        // no se vuelve a crear el rango en Factus.
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "FACTUS", {
          factusCredentialsEncrypted: company.factusCredentialsEncrypted,
        });
      } else {
        await this.activateFactusWithNewCredentials(companyId, input.factusCredentials);
      }
    } else {
      // Volver a DIRECT no borra la credencial guardada (para poder volver a FACTUS despues sin
      // reprovisionar el rango) -- solo cambia que proveedor se usa. Ver ICompanyReader.
      await this.companyReader.updateElectronicInvoicingProvider(companyId, "DIRECT", {});
    }

    await this.audit.record({
      action: "ELECTRONIC_INVOICING_PROVIDER_CHANGED",
      entityType: "Company",
      entityId: companyId,
      description: `Proveedor de facturacion electronica cambiado a ${input.provider}`,
    });
  }

  /** Falla cerrado: si no hay suscripcion activa (TRIALING/ACTIVE/GRACE_PERIOD) tampoco se deja
   * activar FACTUS -- sin un plan de pago confirmado no hay garantia de que la empresa vaya a
   * pagar la bolsa que consume. */
  private async assertNotOnTrialPlan(companyId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findActiveByCompanyId(companyId);
    if (!subscription) {
      throw new ValidationError("Esta empresa no tiene una suscripcion activa -- no se puede activar Factus");
    }
    const plan = await this.planRepo.findByIdOrThrow(subscription.planId);
    if (plan.code === "TRIAL") {
      throw new ValidationError(
        "El plan de prueba gratuita no puede usar Factus -- elegi un plan pago para activar la facturacion electronica via proveedor tecnologico"
      );
    }
  }

  private async activateFactusWithNewCredentials(companyId: string, credentials: FactusCredentialsInput): Promise<void> {
    const resolutions = await this.numberingResolutionRepo.list();
    const resolution = resolutions.find((r) => r.documentType === "FACTURA_VENTA" && r.isActive);
    if (!resolution) {
      throw new ValidationError(
        "No hay una resolucion DIAN de factura de venta activa -- crea una en Numeracion antes de activar Factus"
      );
    }

    // Bloqueante: sin un rango de numeracion, Factus no puede recibir ninguna factura -- no tiene
    // sentido dejar la empresa activada con FACTUS si esto falla. Se envuelve en ValidationError
    // (mensaje claro al usuario, 400) en vez de dejar que el error crudo del provisioner llegue
    // sin envolver al errorHandlerMiddleware (que lo mostraria como 500 generico "Error interno
    // del servidor", sin explicar que fue Factus quien rechazo la creacion del rango).
    let numberingRangeId: number;
    try {
      numberingRangeId = await this.factusProvisioner.createSalesNumberingRange(credentials, {
        prefix: resolution.prefix,
        resolutionNumber: resolution.resolutionNumber,
        current: resolution.rangeFrom,
      });
    } catch (err) {
      throw new ValidationError(
        `No se pudo crear el rango de numeracion en Factus: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const company = await this.companyReader.findByIdOrThrow(companyId);
    if (company.logoUrl) {
      try {
        await this.factusProvisioner.uploadLogo(credentials, company.logoUrl);
      } catch (err) {
        // No bloqueante: el logo no es necesario para poder facturar -- se audita y se sigue.
        await this.audit.record({
          action: "ELECTRONIC_INVOICING_PROVIDER_CHANGED",
          entityType: "Company",
          entityId: companyId,
          description: `No se pudo subir el logo a Factus al activar el proveedor: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const encrypted = encryptCredential(JSON.stringify({ ...credentials, numberingRangeId }), env.CREDENTIALS_ENCRYPTION_KEY);
    await this.companyReader.updateElectronicInvoicingProvider(companyId, "FACTUS", { factusCredentialsEncrypted: encrypted });
  }
}
