export interface SigningCertificate {
  privateKeyPem: string;
  certificatePem: string;
  /** Intermedios/raiz, si el .p12 los trae. No usados aun por el firmador (ver infra). */
  certificateChainPem?: string[];
}

export interface IXmlSigner {
  /**
   * Produce un XML firmado XAdES a partir de un UBL sin firmar. Operacion local/CPU-bound
   * (criptografia), sin red -- puede ejecutarse de forma sincrona dentro del flujo de venta.
   */
  sign(unsignedXml: string, cert: SigningCertificate): Promise<string>;
}
