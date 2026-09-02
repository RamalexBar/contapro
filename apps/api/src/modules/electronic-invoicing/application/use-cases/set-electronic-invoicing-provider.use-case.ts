import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { encryptCredential } from "../../../../shared/crypto/credential-cipher";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyReader } from "../../domain/company-reader.repository";

export interface SetElectronicInvoicingProviderInput {
  provider: "DIRECT" | "MATIAS";
  /** Token en texto plano, tal como lo entrega MATIAS -- se cifra aqui, nunca se guarda en claro.
   * Requerido si provider === "MATIAS" y la empresa todavia no tiene uno cargado. */
  apiToken?: string;
}

/**
 * Carga/cambia el proveedor tecnologico DIAN de la empresa (ver README, seccion "Proveedor
 * tecnologico (MATIAS API)"). El token nunca se vuelve a devolver en texto plano una vez cargado
 * -- mismo criterio que create-api-key.use-case.ts (modules/public-api) para las API keys
 * salientes de Contapro.
 */
export class SetElectronicInvoicingProviderUseCase {
  constructor(
    private readonly companyReader: ICompanyReader,
    private readonly audit: AuditService
  ) {}

  async execute(input: SetElectronicInvoicingProviderInput): Promise<void> {
    const companyId = getTenantContext().companyId;

    if (input.provider === "MATIAS") {
      if (!env.CREDENTIALS_ENCRYPTION_KEY) {
        throw new ValidationError("CREDENTIALS_ENCRYPTION_KEY no esta configurado en el servidor");
      }
      if (!input.apiToken) {
        const company = await this.companyReader.findByIdOrThrow(companyId);
        if (!company.matiasApiTokenEncrypted) {
          throw new ValidationError("Se requiere apiToken para activar el proveedor MATIAS");
        }
        // Cambio de DIRECT a MATIAS reusando un token ya cargado antes -- no se pide de nuevo.
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "MATIAS", company.matiasApiTokenEncrypted);
      } else {
        const encrypted = encryptCredential(input.apiToken, env.CREDENTIALS_ENCRYPTION_KEY);
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "MATIAS", encrypted);
      }
    } else {
      // Volver a DIRECT no borra el token guardado (para poder volver a MATIAS despues sin
      // recargarlo) -- solo cambia que proveedor se usa. Ver ICompanyReader.
      const company = await this.companyReader.findByIdOrThrow(companyId);
      await this.companyReader.updateElectronicInvoicingProvider(companyId, "DIRECT", company.matiasApiTokenEncrypted);
    }

    await this.audit.record({
      action: "ELECTRONIC_INVOICING_PROVIDER_CHANGED",
      entityType: "Company",
      entityId: companyId,
      description: `Proveedor de facturacion electronica cambiado a ${input.provider}`,
    });
  }
}
