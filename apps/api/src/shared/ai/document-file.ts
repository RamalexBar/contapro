import { AppError } from "../errors/app-error";
import { z } from "zod";

/** Foto o PDF que se le pasa a Claude para leerlo (facturas de compra, soportes de gastos, extractos). */
export interface DocumentFileInput {
  /** Base64 sin el prefijo "data:...;base64,". */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
}

// ~13MB en base64 (~10MB reales): suficiente para una foto de celular o un PDF escaneado, con
// margen bajo el limite de 20mb del body JSON (ver express.json({ limit }) en app.ts).
export const MAX_DOCUMENT_BASE64_LENGTH = 13_000_000;

/** Body de los endpoints que reciben un documento para leer. */
export const documentFileSchema = z.object({
  fileBase64: z.string().min(1).max(MAX_DOCUMENT_BASE64_LENGTH),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

type DocumentContentBlock =
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } };

/** Bloque de contenido de la API de Claude para el archivo: "document" si es PDF, "image" si es foto. */
export function toDocumentContentBlock(file: DocumentFileInput): DocumentContentBlock {
  if (file.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: file.mediaType, data: file.base64 } };
}

/**
 * Convierte un error de la API de Claude (sin saldo, llave invalida, servicio caido...) en un
 * mensaje claro para el usuario, en vez del "Error interno del servidor" generico. El error real
 * queda en el log del servidor. Los demas errores se devuelven tal cual.
 */
export function toFriendlyAiError(err: unknown): unknown {
  const status = (err as { status?: unknown })?.status;
  if (typeof status !== "number") return err;
  console.error("Error de la API de Claude:", err);
  const reason =
    status === 400 || status === 401 || status === 403
      ? "la lectura automática no está disponible en este momento (si sigue pasando, avísale al equipo de ContaPro)"
      : status === 429 || status >= 500
        ? "el servicio de lectura está ocupado o caído en este momento; intenta de nuevo en unos minutos"
        : "no se pudo leer el documento";
  return new AppError(`No se pudo leer el documento: ${reason}. Mientras tanto, puedes registrarlo a mano.`, 503, "AI_UNAVAILABLE");
}
