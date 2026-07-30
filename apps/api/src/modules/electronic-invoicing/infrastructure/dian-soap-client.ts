/**
 * NO PROBADO CONTRA LA DIAN REAL. Todo en este archivo -- la URL del servicio, los nombres de
 * operacion, el formato del sobre SOAP/autenticacion, el nombre de entrada del zip, y el
 * parseo de la respuesta -- es la mejor comprension documentada publicamente de integraciones
 * DIAN existentes, NO verificada contra el WSDL/Anexo Tecnico vigente. No se escribio (ni se
 * debe escribir) una prueba automatizada para este archivo: un mock aqui daria una falsa
 * sensacion de que "ya funciona", cuando en realidad nadie ha confirmado el formato real hasta
 * probarlo con credenciales de habilitacion de verdad. Ver README del modulo.
 *
 * Deliberadamente NO se usa el paquete `soap` (WSDL codegen): la comunidad de integradores
 * colombianos reporta friccion frecuente entre clientes generados desde el WSDL y el
 * comportamiento real del servicio de la DIAN. Se arma el sobre a mano para poder inspeccionar
 * y ajustar cada campo sin pelear con una capa de generacion automatica.
 */
import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import type { Document as XmlDocument } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { env } from "../../../config/env";
import type { DianStatusResult, DianSubmissionResult, IDianClient } from "../domain/dian-client";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const DIAN_NS = "http://wcf.dian.colombia";

function zipAndBase64(signedXml: string): string {
  const zip = new AdmZip();
  // Nombre de entrada generico -- la DIAN probablemente espera el CUFE o numero de factura
  // como nombre de archivo dentro del zip; sin verificar (ver aviso de cabecera).
  zip.addFile("factura.xml", Buffer.from(signedXml, "utf-8"));
  return zip.toBuffer().toString("base64");
}

async function postSoap(action: string, bodyXml: string): Promise<XmlDocument> {
  if (!env.DIAN_SOAP_ENDPOINT) {
    throw new Error("DIAN_SOAP_ENDPOINT no esta configurado");
  }

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:dian="${DIAN_NS}">
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(env.DIAN_SOAP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
    },
    body: envelope,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Respuesta HTTP ${response.status} de la DIAN: ${responseText.slice(0, 500)}`);
  }

  return new DOMParser().parseFromString(responseText, "text/xml");
}

function textAt(doc: XmlDocument, path: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const node = xpath.select1(path, doc as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (node as any)?.textContent ?? undefined;
}

export class DianSoapClient implements IDianClient {
  async sendBillAsync(signedXml: string): Promise<DianSubmissionResult> {
    const zipBase64 = zipAndBase64(signedXml);
    const bodyXml = `<dian:SendBillAsync>
      <dian:fileName>factura.zip</dian:fileName>
      <dian:contentFile>${zipBase64}</dian:contentFile>
      <dian:softwareId>${env.DIAN_SOFTWARE_ID}</dian:softwareId>
      <dian:softwarePin>${env.DIAN_SOFTWARE_PIN}</dian:softwarePin>
    </dian:SendBillAsync>`;

    const doc = await postSoap("SendBillAsync", bodyXml);
    // Nombre de campo del ID de seguimiento sin confirmar (posibles alternativas: ZipKey,
    // trackId) -- ajustar aqui una vez se pruebe contra la DIAN real.
    const trackingId = textAt(doc, "//*[local-name()='trackId']") ?? textAt(doc, "//*[local-name()='ZipKey']");

    if (!trackingId) {
      throw new Error(`La DIAN no devolvio un id de seguimiento reconocible: ${new XMLSerializerFallback().serialize(doc)}`);
    }

    return { trackingId };
  }

  async getStatus(trackingId: string): Promise<DianStatusResult> {
    const bodyXml = `<dian:GetStatusZip>
      <dian:trackId>${trackingId}</dian:trackId>
    </dian:GetStatusZip>`;

    const doc = await postSoap("GetStatusZip", bodyXml);
    // Codigos de estado y ubicacion del motivo de rechazo sin confirmar contra la DIAN real.
    const statusCode = textAt(doc, "//*[local-name()='StatusCode']");
    const statusDescription = textAt(doc, "//*[local-name()='StatusDescription']");

    if (!statusCode || statusCode === "PENDIENTE") {
      return { status: "PENDING" };
    }
    if (statusCode === "00" || statusCode?.toUpperCase() === "EXITOSO") {
      return { status: "ACCEPTED", responseXml: new XMLSerializerFallback().serialize(doc) };
    }
    return {
      status: "REJECTED",
      responseXml: new XMLSerializerFallback().serialize(doc),
      rejectionReason: statusDescription ?? "Rechazado por la DIAN (motivo no identificado en la respuesta)",
    };
  }
}

/** Evita depender de xmldom's XMLSerializer solo para logging/almacenar la respuesta cruda. */
class XMLSerializerFallback {
  serialize(doc: XmlDocument): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (doc as any).toString?.() ?? String(doc);
    } catch {
      return "[respuesta DIAN no serializable]";
    }
  }
}
