import { env } from "../../../config/env";
import { decryptCredential } from "../../../shared/crypto/credential-cipher";
import type { AuditService } from "../../audit/application/audit.service";
import type { AuditAction } from "../../audit/domain/audit-log.repository";
import type { ThirdPartyDocumentResult } from "../domain/third-party-invoicing-client";

/**
 * Envia una nota credito/debito o un documento soporte al proveedor tecnologico (Factus) y guarda
 * el resultado. No lanza: igual que la factura, el documento de negocio (la nota, la devolucion,
 * la compra) ya quedo registrado, y si el proveedor falla el documento electronico queda
 * GENERATED o REJECTED, recuperable con el reenvio manual.
 */
export async function submitThirdPartyDocument(params: {
  encryptedCredential: string | null;
  submit: (credentials: string) => Promise<ThirdPartyDocumentResult>;
  apply: (result: ThirdPartyDocumentResult) => Promise<void>;
  audit: AuditService;
  entityType: string;
  entityId: string;
  /** "Nota credito", "Nota debito", "Documento soporte". */
  label: string;
  internalNumber: string;
  failedAction: AuditAction;
}): Promise<ThirdPartyDocumentResult | null> {
  const { audit, entityType, entityId, label, internalNumber } = params;

  if (!params.encryptedCredential) {
    await audit.record({
      action: params.failedAction,
      entityType,
      entityId,
      description: `${label} ${internalNumber}: la empresa usa FACTUS pero no tiene credenciales cargadas`,
    });
    return null;
  }

  try {
    const credentials = decryptCredential(params.encryptedCredential, env.CREDENTIALS_ENCRYPTION_KEY);
    const result = await params.submit(credentials);
    await params.apply(result);
    await audit.record({
      action: result.status === "ACCEPTED" ? "ELECTRONIC_DOCUMENT_ACCEPTED" : "ELECTRONIC_DOCUMENT_REJECTED",
      entityType,
      entityId,
      description:
        result.status === "ACCEPTED"
          ? `${label} autorizada via FACTUS: ${result.number} (${result.uniqueCode.slice(0, 12)}...)`
          : `${label} ${internalNumber} rechazada por FACTUS: ${result.rejectionReason}`,
      metadata: { internalNumber, number: result.number || undefined, uniqueCode: result.uniqueCode || undefined, rejectionReason: result.rejectionReason },
    });
    return result;
  } catch (err) {
    await audit.record({
      action: params.failedAction,
      entityType,
      entityId,
      description: `Fallo la llamada a FACTUS para ${label.toLowerCase()} ${internalNumber}: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}

/** JSON.stringify de la solicitud, con las fechas como ISO, y su inverso para el reenvio. */
export function serializeProviderRequest(input: object): string {
  return JSON.stringify(input);
}

export function parseProviderRequest<T>(raw: string, dateKeys: string[]): T {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const key of dateKeys) {
    if (typeof parsed[key] === "string") parsed[key] = new Date(parsed[key] as string);
  }
  return parsed as T;
}
