import type { SigningCertificate } from "./xml-signer";

/**
 * Puerto separado del firmador para que "de donde sale el certificado" (hoy: archivo .p12
 * local) pueda cambiar (ej. un secret manager en la nube) sin tocar la logica de firma XAdES.
 */
export interface ICertificateLoader {
  /** Lee y descifra un archivo PKCS#12 (.p12/.pfx). Lanza CertificateError si falla. */
  load(p12Path: string, password: string): Promise<SigningCertificate>;
}
