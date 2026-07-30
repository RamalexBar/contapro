/**
 * UNVERIFICADO contra el Anexo Tecnico DIAN vigente. Este modulo produce una firma XAdES-BES
 * (enveloped, sobre todo el documento). El Anexo Tecnico de la DIAN ha exigido historicamente
 * XAdES-**EPES** con un `SignaturePolicyId` especifico (OID de la politica + hash del documento
 * de politica), no XAdES-BES plano -- un detalle que ha hecho tropezar a mas de una integracion
 * colombiana con la DIAN. NO enviar a la DIAN real sin antes confirmar el requisito de politica
 * de firma vigente en el Anexo Tecnico y agregar el bloque `SignaturePolicyIdentifier` si aplica.
 * Tal como esta, esto solo garantiza una firma XAdES-BES estructuralmente valida y verificable
 * criptograficamente -- nada especifico de la DIAN mas alla de eso.
 */
import * as xadesjs from "xadesjs";
import * as xmlCore from "xml-core";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as xpath from "xpath";
import * as forge from "node-forge";
import type { IXmlSigner, SigningCertificate } from "../domain/xml-signer";

let engineConfigured = false;

function ensureEngine(): void {
  if (engineConfigured) return;
  xmlCore.setNodeDependencies({ DOMParser, XMLSerializer, xpath });
  // El spike de esta iteracion confirmo que el WebCrypto nativo de Node 20 es suficiente --
  // no hizo falta @peculiar/webcrypto.
  xadesjs.Application.setEngine("NodeJS", globalThis.crypto as unknown as Crypto);
  engineConfigured = true;
}

/** PEM -> DER binario (string forge) -> Uint8Array respaldado por un ArrayBuffer real (no
 * ArrayBufferLike), para que crypto.subtle.importKey lo acepte. */
function pemToDerBytes(pem: string, forgeConvert: (pem: string) => forge.util.ByteStringBuffer): Uint8Array<ArrayBuffer> {
  const der = forgeConvert(pem).getBytes();
  const arrayBuffer = new ArrayBuffer(der.length);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < der.length; i++) bytes[i] = der.charCodeAt(i) & 0xff;
  return bytes;
}

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const forgeKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey;
  const pkcs8Der = pemToDerBytes(privateKeyPem, () =>
    forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(forgeKey)))
  );
  return globalThis.crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );
}

function certificateToBase64Der(certificatePem: string): string {
  const der = forge.pki.pemToDer(certificatePem).getBytes();
  return Buffer.from(der, "binary").toString("base64");
}

export class XadesXmlSigner implements IXmlSigner {
  async sign(unsignedXml: string, cert: SigningCertificate): Promise<string> {
    ensureEngine();

    const privateKey = await importPrivateKey(cert.privateKeyPem);
    const certificateBase64 = certificateToBase64Der(cert.certificatePem);

    const doc = xadesjs.Parse(unsignedXml);
    const signedXml = new xadesjs.SignedXml();

    await signedXml.Sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      doc,
      {
        x509: [certificateBase64],
        signingCertificate: certificateBase64,
        references: [{ hash: "SHA-256", transforms: ["enveloped"] }],
      }
    );

    return signedXml.toString();
  }
}
