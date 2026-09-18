import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { encryptCredential } from "../../../../shared/crypto/credential-cipher";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyReader } from "../../domain/company-reader.repository";

export interface FactusCredentialsInput {
  clientId: string;
  clientSecret: string;
  email: string;
  password: string;
  numberingRangeId: number;
}

export interface SetElectronicInvoicingProviderInput {
  provider: "DIRECT" | "MATIAS" | "FACTUS";
  /** Token en texto plano, tal como lo entrega MATIAS -- se cifra aqui, nunca se guarda en claro.
   * Requerido si provider === "MATIAS" y la empresa todavia no tiene uno cargado. */
  apiToken?: string;
  /** Las 4 credenciales OAuth2 + el numbering_range_id de Factus, en texto plano -- se
   * empaquetan en un solo JSON y se cifran juntas aqui. Requerido si provider === "FACTUS" y la
   * empresa todavia no tiene credenciales cargadas. */
  factusCredentials?: FactusCredentialsInput;
}

/**
 * Carga/cambia el proveedor tecnologico DIAN de la empresa (ver README, seccion "Proveedor
 * tecnologico (MATIAS API / Factus API)"). Las credenciales nunca se vuelven a devolver en texto
 * plano una vez cargadas -- mismo criterio que create-api-key.use-case.ts (modules/public-api)
 * para las API keys salientes de Contapro.
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
        // Cambio a MATIAS reusando un token ya cargado antes -- no se pide de nuevo.
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "MATIAS", { matiasApiTokenEncrypted: company.matiasApiTokenEncrypted });
      } else {
        const encrypted = encryptCredential(input.apiToken, env.CREDENTIALS_ENCRYPTION_KEY);
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "MATIAS", { matiasApiTokenEncrypted: encrypted });
      }
    } else if (input.provider === "FACTUS") {
      if (!env.CREDENTIALS_ENCRYPTION_KEY) {
        throw new ValidationError("CREDENTIALS_ENCRYPTION_KEY no esta configurado en el servidor");
      }
      if (!input.factusCredentials) {
        const company = await this.companyReader.findByIdOrThrow(companyId);
        if (!company.factusCredentialsEncrypted) {
          throw new ValidationError("Se requieren las credenciales de Factus para activar ese proveedor");
        }
        // Cambio a FACTUS reusando credenciales ya cargadas antes -- no se piden de nuevo.
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "FACTUS", {
          factusCredentialsEncrypted: company.factusCredentialsEncrypted,
        });
      } else {
        const encrypted = encryptCredential(JSON.stringify(input.factusCredentials), env.CREDENTIALS_ENCRYPTION_KEY);
        await this.companyReader.updateElectronicInvoicingProvider(companyId, "FACTUS", { factusCredentialsEncrypted: encrypted });
      }
    } else {
      // Volver a DIRECT no borra ninguna credencial guardada (para poder volver a MATIAS/FACTUS
      // despues sin recargarla) -- solo cambia que proveedor se usa. Ver ICompanyReader.
      await this.companyReader.updateElectronicInvoicingProvider(companyId, "DIRECT", {});
    }

    await this.audit.record({
      action: "ELECTRONIC_INVOICING_PROVIDER_CHANGED",
      entityType: "Company",
      entityId: companyId,
      description: `Proveedor de facturacion electronica cambiado a ${input.provider}`,
    });
  }
}
