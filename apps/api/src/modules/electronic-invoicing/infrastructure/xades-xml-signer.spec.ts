import { DOMParser } from "@xmldom/xmldom";
import * as xadesjs from "xadesjs";
import * as xmlCore from "xml-core";
import * as xpath from "xpath";
import { XMLSerializer } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { generateTestCertificate } from "./__fixtures__/self-signed-cert";
import { XadesXmlSigner } from "./xades-xml-signer";

const SAMPLE_UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">SETP1</cbc:ID>
</Invoice>`;

describe("XadesXmlSigner", () => {
  it("produces well-formed XML containing a ds:Signature element", async () => {
    const cert = generateTestCertificate();
    const signer = new XadesXmlSigner();

    const signedXml = await signer.sign(SAMPLE_UBL, {
      privateKeyPem: cert.privateKeyPem,
      certificatePem: cert.certificatePem,
    });

    expect(() => new DOMParser().parseFromString(signedXml, "text/xml")).not.toThrow();
    expect(signedXml).toContain("ds:Signature");
    expect(signedXml).toContain("QualifyingProperties");
  });

  it("produces a signature that verifies successfully", async () => {
    xmlCore.setNodeDependencies({ DOMParser, XMLSerializer, xpath });
    xadesjs.Application.setEngine("NodeJS", globalThis.crypto as unknown as Crypto);

    const cert = generateTestCertificate();
    const signer = new XadesXmlSigner();
    const signedXml = await signer.sign(SAMPLE_UBL, {
      privateKeyPem: cert.privateKeyPem,
      certificatePem: cert.certificatePem,
    });

    const doc = xadesjs.Parse(signedXml);
    const sigNodes = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature");
    expect(sigNodes.length).toBe(1);

    const verifier = new xadesjs.SignedXml(doc);
    verifier.LoadXml(sigNodes[0] as unknown as Element);
    const isValid = await verifier.Verify();

    expect(isValid).toBe(true);
  });

  // No se verifica nada especifico de la DIAN (XAdES-EPES, XSD oficial) -- no es verificable
  // sin el validador real de la DIAN. Ver el aviso en el encabezado de xades-xml-signer.ts.
});
