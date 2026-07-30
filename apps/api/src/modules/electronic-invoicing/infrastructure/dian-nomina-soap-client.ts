/**
 * NO PROBADO CONTRA LA DIAN REAL -- y con MENOS certeza que dian-soap-client.ts (facturacion).
 * La nomina electronica (Resolucion 000013 de 2021) usa un servicio web de la DIAN distinto al
 * de facturacion electronica, con su propio WSDL. A diferencia de facturacion (donde al menos el
 * patron SendBillAsync/GetStatusZip es razonablemente citado en integraciones publicas), aqui ni
 * siquiera los nombres de operacion estan confirmados con la misma confianza -- los nombres
 * usados abajo (`SendNominaAsync`/`GetStatusNomina`) son un placeholder plausible, no una cita
 * verificada. No se escribio (ni se debe escribir) una prueba automatizada para este archivo:
 * un mock aqui daria una falsa sensacion de que "ya funciona". Ver README del modulo.
 *
 * Deliberadamente un cliente separado de DianSoapClient (no una variante parametrizada): son dos
 * servicios DIAN distintos con su propio endpoint (DIAN_NOMINA_SOAP_ENDPOINT) y, muy
 * probablemente, formato de sobre distinto una vez se verifique contra la DIAN real -- mezclar
 * ambos en una sola clase generica atarian prematuramente dos superficies que hoy no se sabe si
 * son compatibles.
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
  zip.addFile("nomina.xml", Buffer.from(signedXml, "utf-8"));
  return zip.toBuffer().toString("base64");
}

async function postSoap(action: string, bodyXml: string): Promise<XmlDocument> {
  if (!env.DIAN_NOMINA_SOAP_ENDPOINT) {
    throw new Error("DIAN_NOMINA_SOAP_ENDPOINT no esta configurado");
  }

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:dian="${DIAN_NS}">
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(env.DIAN_NOMINA_SOAP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
    },
    body: envelope,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Respuesta HTTP ${response.status} de la DIAN (nomina): ${responseText.slice(0, 500)}`);
  }

  return new DOMParser().parseFromString(responseText, "text/xml");
}

function textAt(doc: XmlDocument, path: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const node = xpath.select1(path, doc as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (node as any)?.textContent ?? undefined;
}

export class DianNominaSoapClient implements IDianClient {
  async sendBillAsync(signedXml: string): Promise<DianSubmissionResult> {
    const zipBase64 = zipAndBase64(signedXml);
    const bodyXml = `<dian:SendNominaAsync>
      <dian:fileName>nomina.zip</dian:fileName>
      <dian:contentFile>${zipBase64}</dian:contentFile>
      <dian:softwareId>${env.DIAN_SOFTWARE_ID}</dian:softwareId>
      <dian:softwarePin>${env.DIAN_SOFTWARE_PIN}</dian:softwarePin>
    </dian:SendNominaAsync>`;

    const doc = await postSoap("SendNominaAsync", bodyXml);
    const trackingId = textAt(doc, "//*[local-name()='trackId']") ?? textAt(doc, "//*[local-name()='ZipKey']");

    if (!trackingId) {
      throw new Error(`La DIAN no devolvio un id de seguimiento reconocible: ${new XMLSerializerFallback().serialize(doc)}`);
    }

    return { trackingId };
  }

  async getStatus(trackingId: string): Promise<DianStatusResult> {
    const bodyXml = `<dian:GetStatusNomina>
      <dian:trackId>${trackingId}</dian:trackId>
    </dian:GetStatusNomina>`;

    const doc = await postSoap("GetStatusNomina", bodyXml);
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
