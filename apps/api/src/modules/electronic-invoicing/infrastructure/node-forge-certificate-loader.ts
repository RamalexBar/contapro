import { readFileSync } from "node:fs";
import * as forge from "node-forge";
import { CertificateError } from "../../../shared/errors/app-error";
import type { ICertificateLoader } from "../domain/certificate-loader";
import type { SigningCertificate } from "../domain/xml-signer";

export class NodeForgeCertificateLoader implements ICertificateLoader {
  async load(p12Path: string, password: string): Promise<SigningCertificate> {
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      const p12Der = readFileSync(p12Path, "binary");
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch {
      // Nunca incluir la contraseña en el mensaje de error.
      throw new CertificateError(`No se pudo leer/descifrar el certificado en ${p12Path}`);
    }

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const certBag = certBags[forge.pki.oids.certBag]?.[0];

    if (!keyBag?.key || !certBag?.cert) {
      throw new CertificateError(`El certificado en ${p12Path} no contiene una llave privada y un certificado validos`);
    }

    const certificateChainPem = (certBags[forge.pki.oids.certBag] ?? [])
      .slice(1)
      .filter((bag): bag is typeof certBag & { cert: forge.pki.Certificate } => Boolean(bag.cert))
      .map((bag) => forge.pki.certificateToPem(bag.cert));

    return {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
      certificatePem: forge.pki.certificateToPem(certBag.cert),
      certificateChainPem: certificateChainPem.length > 0 ? certificateChainPem : undefined,
    };
  }
}
