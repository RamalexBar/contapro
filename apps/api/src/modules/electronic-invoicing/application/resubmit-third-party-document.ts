import { ConflictError, ValidationError } from "../../../shared/errors/app-error";
import type { AuditService } from "../../audit/application/audit.service";
import type { AuditAction } from "../../audit/domain/audit-log.repository";
import type { CompanyRecord } from "../domain/company-reader.repository";
import type { ThirdPartyDocumentResult } from "../domain/third-party-invoicing-client";
import { submitThirdPartyDocument } from "./submit-third-party-document";

/**
 * Reenvio manual de una nota o documento soporte de una empresa con FACTUS: manda la misma solicitud
 * guardada (mismo reference_code), asi que si el documento si alcanzo a crearse en Factus, Factus
 * devuelve ese mismo y no crea uno duplicado.
 */
export async function resubmitThirdPartyDocument(params: {
  company: CompanyRecord;
  document: { id: string; fullNumber: string; status: string; providerRequest: string | null };
  submit: (credentials: string, providerRequest: string) => Promise<ThirdPartyDocumentResult>;
  apply: (result: ThirdPartyDocumentResult) => Promise<void>;
  audit: AuditService;
  entityType: string;
  entityId: string;
  label: string;
  failedAction: AuditAction;
}): Promise<void> {
  const { document, label } = params;
  if (document.status === "ACCEPTED") {
    throw new ConflictError(`${label} ${document.fullNumber} ya esta autorizada, nada que reenviar`);
  }
  if (!document.providerRequest) {
    throw new ValidationError(`${label} ${document.fullNumber} se genero antes de usar Factus y no se puede reenviar por ahi`);
  }
  const providerRequest = document.providerRequest;
  const result = await submitThirdPartyDocument({
    encryptedCredential: params.company.factusCredentialsEncrypted,
    submit: (credentials) => params.submit(credentials, providerRequest),
    apply: params.apply,
    audit: params.audit,
    entityType: params.entityType,
    entityId: params.entityId,
    label,
    internalNumber: document.fullNumber,
    failedAction: params.failedAction,
  });
  if (!result) {
    throw new ConflictError(`No se pudo enviar ${label.toLowerCase()} ${document.fullNumber} a Factus. El detalle quedo en Auditoria.`);
  }
  if (result.status === "REJECTED") {
    throw new ValidationError(`Factus rechazo ${label.toLowerCase()} ${document.fullNumber}: ${result.rejectionReason}`);
  }
}
