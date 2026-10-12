import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// El helper de salida estructurada del SDK de Anthropic tipa contra "zod/v4" (subpath que
// zod>=3.25 expone para compatibilidad), no contra el namespace clasico "zod" que usa el resto
// de este proyecto (validators.ts, etc.) -- mismo paquete instalado, import distinto solo para
// que el tipo de este schema calce con `zodOutputFormat`. La API (z.object/z.string/...) es igual.
import { z } from "zod/v4";
import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors/app-error";
import type { ExtractedPurchaseInvoice, IInvoiceExtractionService, InvoiceFileInput } from "../domain/invoice-extraction.port";

const extractionSchema = z.object({
  supplierName: z.string().nullable().describe("Nombre o razon social del proveedor que emite la factura"),
  supplierNit: z.string().nullable().describe("NIT o numero de documento del proveedor, sin puntos ni espacios"),
  invoiceNumber: z.string().nullable().describe("Numero/consecutivo de la factura"),
  issueDate: z.string().nullable().describe("Fecha de emision en formato ISO yyyy-mm-dd"),
  subtotal: z.number().nullable().describe("Subtotal antes de impuestos, en la moneda del documento"),
  taxTotal: z.number().nullable().describe("Total de IVA/impuestos de la factura"),
  total: z.number().nullable().describe("Total final de la factura (subtotal + impuestos)"),
  currency: z.string().describe('Codigo ISO 4217 de la moneda, "COP" si no se indica ninguna otra'),
  items: z
    .array(
      z.object({
        description: z.string().describe("Nombre o descripcion del producto tal como aparece en el renglon"),
        code: z.string().nullable().describe("Codigo, referencia o codigo de barras del renglon, si aparece"),
        quantity: z.number().nullable().describe("Cantidad facturada"),
        unitPrice: z.number().nullable().describe("Valor unitario ANTES de IVA y despues del descuento del renglon"),
        taxRate: z.number().nullable().describe("Porcentaje de IVA del renglon (19, 5 o 0), null si no se indica"),
        lineTotal: z.number().nullable().describe("Total del renglon antes de IVA"),
      })
    )
    .describe("Un elemento por cada renglon de producto de la factura, en el mismo orden. Lista vacia si la factura no detalla productos."),
  warnings: z.array(z.string()).describe(
    "Notas cortas en español sobre datos ilegibles, inconsistentes (ej. subtotal+IVA != total) o que el usuario deberia revisar a mano. Lista vacia si todo se leyo con confianza."
  ),
});

const EXTRACTION_PROMPT = `Estas leyendo la foto o el PDF de una factura de compra colombiana para precargar un formulario de registro de compra. Extrae unicamente lo que dice el documento -- si un dato no aparece o no se puede leer con confianza, devuelve null en ese campo en vez de adivinar. Si subtotal + impuestos no cuadra con el total, o si hay retenciones/descuentos que no encajan en este esquema, dejalo anotado en "warnings" en vez de forzar el numero. No inventes NIT ni numero de factura. En "items" copia cada renglon de producto: si el valor unitario impreso incluye IVA, calcula el valor antes de IVA y anotalo en "warnings"; no incluyas renglones de fletes, descuentos globales ni totales.`;

type FileContentBlock =
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } };

function toContentBlock(file: InvoiceFileInput): FileContentBlock {
  if (file.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: file.mediaType, data: file.base64 } };
}

/**
 * Lectura automatica de facturas via Claude API (vision + salida estructurada validada con Zod,
 * `client.messages.parse` + `zodOutputFormat`). NO PROBADO contra facturas reales variadas en
 * este entorno -- mismo aviso que dian-soap-client.ts/whatsapp-cloud-api-sender.ts: el formato
 * sigue la documentacion de la API al momento de escribir esto. Es de solo lectura: nunca crea ni
 * modifica nada, solo devuelve el borrador que ExtractPurchaseInvoiceUseCase le entrega al
 * usuario para revisar antes de registrar la compra con POST /purchases (ya existente).
 */
export class ClaudeInvoiceExtractionService implements IInvoiceExtractionService {
  async extract(file: InvoiceFileInput): Promise<ExtractedPurchaseInvoice> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new ValidationError("ANTHROPIC_API_KEY no esta configurada");
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const response = await client.messages.parse({
      model: "claude-opus-5",
      // Una factura con muchos renglones devuelve bastante JSON.
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(extractionSchema) },
      messages: [
        {
          role: "user",
          content: [toContentBlock(file) as never, { type: "text", text: EXTRACTION_PROMPT }],
        },
      ],
    });

    if (!response.parsed_output) {
      throw new ValidationError("No se pudo leer la factura -- intenta con una foto mas clara o el PDF original");
    }

    return response.parsed_output;
  }
}
