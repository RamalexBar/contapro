import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado simetrico (AES-256-GCM) para credenciales de terceros que Contapro necesita poder
 * volver a leer en texto plano (ej. el token de MATIAS/Plemsi de cada empresa, para reenviarlo en
 * cada llamada saliente) -- a diferencia de los API keys salientes de public-api/webhooks, que se
 * guardan hasheados porque solo hace falta *verificarlos*, nunca reenviarlos. No existia ninguna
 * utilidad de cifrado reversible en el repo antes de esto.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM

function resolveKey(masterKeyHex: string): Buffer {
  if (!masterKeyHex) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY no esta configurado");
  }
  const key = Buffer.from(masterKeyHex, "hex");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres)");
  }
  return key;
}

/** Formato de salida: "{iv}:{authTag}:{ciphertext}", los 3 en hex. */
export function encryptCredential(plaintext: string, masterKeyHex: string): string {
  const key = resolveKey(masterKeyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptCredential(encrypted: string, masterKeyHex: string): string {
  const key = resolveKey(masterKeyHex);
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Formato de credencial cifrada invalido");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}
