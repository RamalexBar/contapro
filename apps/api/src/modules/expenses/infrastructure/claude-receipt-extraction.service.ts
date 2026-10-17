import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// Mismo motivo que claude-invoice-extraction.service.ts: el helper del SDK tipa contra "zod/v4".
import { z } from "zod/v4";
import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors/app-error";
import { toDocumentContentBlock, toFriendlyAiError, type DocumentFileInput } from "../../../shared/ai/document-file";
import type { ExpenseCategoryOption, ExtractedExpenseReceipt, IReceiptExtractionService } from "../domain/receipt-extraction.port";

const extractionSchema = z.object({
  payeeName: z.string().nullable().describe("A quien se le pago: nombre o razon social de quien emite el recibo o la factura"),
  payeeNit: z.string().nullable().describe("NIT o documento de quien emite, sin puntos ni espacios"),
  documentNumber: z.string().nullable().describe("Numero de la factura, recibo o cuenta de cobro"),
  issueDate: z.string().nullable().describe("Fecha del documento en formato ISO yyyy-mm-dd"),
  description: z.string().nullable().describe("Que se pago, en pocas palabras (ej. 'Energia septiembre 2026', 'Arriendo local octubre')"),
  subtotal: z.number().nullable().describe("Valor antes de IVA"),
  taxTotal: z.number().nullable().describe("Valor del IVA; 0 si el documento no tiene IVA"),
  total: z.number().nullable().describe("Valor total pagado"),
  categoryCode: z.string().nullable().describe("Codigo de la categoria de gasto de la lista que mejor corresponde; null si ninguna encaja"),
  warnings: z.array(z.string()).describe("Notas cortas en español sobre datos ilegibles o inconsistentes que el usuario deberia revisar. Lista vacia si todo se leyo bien."),
});

function prompt(categories: ExpenseCategoryOption[]): string {
  const list = categories.length > 0 ? categories.map((c) => `- ${c.code}: ${c.name}`).join("\n") : "(la empresa no tiene categorias)";
  return `Estas leyendo la foto o el PDF del soporte de un gasto de una empresa colombiana (factura de servicios publicos, arriendo, recibo, cuenta de cobro, tiquete de taxi, papeleria, etc.) para precargar el formulario "Registrar gasto". Extrae unicamente lo que dice el documento: si un dato no aparece o no se puede leer con confianza, devuelve null en vez de adivinar. No inventes NIT ni numeros. Si el documento no discrimina IVA, pon el total en "subtotal", 0 en "taxTotal" y el total en "total". Si subtotal + IVA no cuadra con el total, anotalo en "warnings".

Elige en "categoryCode" el codigo de la categoria que mejor corresponda a este gasto, solo de esta lista (o null si ninguna encaja):
${list}`;
}

/**
 * Lectura del soporte de un gasto via Claude API (vision + salida estructurada), mismo patron que
 * ClaudeInvoiceExtractionService. Usa Sonnet: un recibo es mucho mas simple que una factura con
 * muchos renglones, y cada lectura la paga Contapro. NO PROBADO contra soportes reales todavia
 * (la cuenta de la API estaba sin saldo al construirlo).
 */
export class ClaudeReceiptExtractionService implements IReceiptExtractionService {
  async extract(file: DocumentFileInput, categories: ExpenseCategoryOption[]): Promise<ExtractedExpenseReceipt> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new ValidationError("ANTHROPIC_API_KEY no esta configurada");
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.messages
      .parse({
        model: "claude-sonnet-5-5",
        max_tokens: 4000,
        output_config: { format: zodOutputFormat(extractionSchema) },
        messages: [
          {
            role: "user",
            content: [toDocumentContentBlock(file) as never, { type: "text", text: prompt(categories) }],
          },
        ],
      })
      .catch((err: unknown) => {
        throw toFriendlyAiError(err);
      });

    if (!response.parsed_output) {
      throw new ValidationError("No se pudo leer el soporte -- intenta con una foto mas clara o el PDF original");
    }
    return response.parsed_output;
  }
}
