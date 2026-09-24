export type FactusActivationMediaType = "application/pdf" | "image/jpeg" | "image/png";

export interface FactusActivationAttachment {
  filename: string;
  mediaType: FactusActivationMediaType;
  /** Contenido crudo en base64, sin el prefijo "data:...;base64,". */
  base64: string;
}

/**
 * Requisitos de activacion por NIT que Factus confirmo por escrito (ver modules/electronic-invoicing/README.md,
 * punto 14, y memoria del proyecto): RUT, certificado de representacion legal (no aplica a persona
 * natural), cedula del representante legal, comprobante de compra del paquete/certificado, y logo.
 */
export interface FactusActivationRequestInput {
  companyName: string;
  nit: string;
  integrationVersion: "v1" | "v2";
  rut: FactusActivationAttachment;
  legalRepCertificate: FactusActivationAttachment | null;
  legalRepId: FactusActivationAttachment;
  purchaseProof: FactusActivationAttachment;
  logo: FactusActivationAttachment;
}

/**
 * Envia la solicitud de activacion de un NIT a Factus (activacion@factus.com.co, confirmado por
 * ellos 2026-09-24) con los 5 documentos adjuntos. `send` debe LANZAR si el envio falla -- mismo
 * criterio que IReminderNotifier, el caller (SendFactusActivationRequestUseCase) solo audita el
 * envio si `send` resuelve sin error.
 */
export interface IFactusActivationNotifier {
  send(input: FactusActivationRequestInput): Promise<void>;
}
