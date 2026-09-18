import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// Mismo motivo que claude-invoice-extraction.service.ts (modulo suppliers): el helper de salida
// estructurada del SDK tipa contra "zod/v4", no contra el "zod" clasico que usa el resto del
// proyecto -- mismo paquete instalado, solo el import cambia para que el schema calce con
// zodOutputFormat.
import { z } from "zod/v4";
import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors/app-error";
import type { ExtractedBankStatement, IStatementExtractionService, StatementFileInput } from "../domain/statement-extraction.port";

const MAX_TRANSACTIONS = 200;

const extractionSchema = z.object({
  transactions: z
    .array(
      z.object({
        date: z.string().describe("Fecha del movimiento en formato ISO yyyy-mm-dd"),
        description: z.string().describe("Descripcion/concepto del movimiento tal como aparece en el extracto"),
        amount: z.number().describe("Valor del movimiento, siempre positivo (el signo lo da el campo type)"),
        type: z.enum(["DEBIT", "CREDIT"]).describe("CREDIT si el dinero entro a la cuenta, DEBIT si salio"),
      })
    )
    .max(MAX_TRANSACTIONS)
    .describe("Una entrada por cada movimiento legible del extracto, en el mismo orden en que aparecen"),
  warnings: z
    .array(z.string())
    .describe(
      "Notas cortas en español sobre filas ilegibles u omitidas, o inconsistencias (ej. saldo final no cuadra con la suma de movimientos). Lista vacia si todo se leyo con confianza."
    ),
});

const EXTRACTION_PROMPT = `Estas leyendo la foto o el PDF de un extracto bancario colombiano para precargar el registro de movimientos en un modulo de conciliacion bancaria. Extrae cada movimiento (fecha, descripcion, valor, si fue debito o credito) en el mismo orden en que aparecen. Si una fila no se puede leer con confianza, omitela del arreglo "transactions" y anotalo en "warnings" en vez de adivinar el valor. No incluyas el saldo inicial/final como si fuera un movimiento -- solo transacciones reales. No inventes fechas ni montos.`;

type FileContentBlock =
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } };

function toContentBlock(file: StatementFileInput): FileContentBlock {
  if (file.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: file.mediaType, data: file.base64 } };
}

/**
 * Lectura automatica de extractos bancarios via Claude API (vision + salida estructurada validada
 * con Zod, `client.messages.parse` + `zodOutputFormat`) -- mismo patron que
 * claude-invoice-extraction.service.ts (modulo suppliers). NO PROBADO todavia contra un extracto
 * real en este entorno: el formato sigue la documentacion de la API al momento de escribir esto,
 * igual que el resto de integraciones de IA del proyecto (ver aviso equivalente en
 * claude-invoice-extraction.service.ts). Es de solo lectura: nunca crea ningun BankTransaction,
 * solo devuelve el borrador que ExtractBankStatementUseCase le entrega al usuario para revisar
 * antes de registrar los movimientos con el POST /bank-accounts/:id/transactions ya existente.
 */
export class ClaudeStatementExtractionService implements IStatementExtractionService {
  async extract(file: StatementFileInput): Promise<ExtractedBankStatement> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new ValidationError("ANTHROPIC_API_KEY no esta configurada");
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8192,
      output_config: { effort: "medium", format: zodOutputFormat(extractionSchema) },
      messages: [
        {
          role: "user",
          content: [toContentBlock(file) as never, { type: "text", text: EXTRACTION_PROMPT }],
        },
      ],
    });

    if (!response.parsed_output) {
      throw new ValidationError("No se pudo leer el extracto -- intenta con una foto mas clara o el PDF original");
    }

    return response.parsed_output;
  }
}
