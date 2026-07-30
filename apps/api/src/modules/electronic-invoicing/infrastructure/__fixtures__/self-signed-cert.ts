import * as forge from "node-forge";

export interface TestCertificate {
  privateKeyPem: string;
  certificatePem: string;
  publicKeyPem: string;
  /** Bytes DER de un .p12 valido, para probar ICertificateLoader sin un archivo real en disco. */
  p12Der: Buffer;
  password: string;
}

/**
 * Genera un certificado autofirmado + su empaquetado PKCS#12 completamente en memoria, solo
 * para pruebas. Nunca representa un certificado real emitido por una entidad certificadora
 * colombiana -- sirve unicamente para probar que la criptografia de firma/carga funciona.
 */
export function generateTestCertificate(password = "test1234"): TestCertificate {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [
    { name: "commonName", value: "Test DIAN Emisor" },
    { name: "countryName", value: "CO" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des" });
  const p12DerString = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Der = Buffer.from(p12DerString, "binary");

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
    p12Der,
    password,
  };
}
