import { env } from "../../config/env";
import type { IObjectStorage } from "./object-storage";
import { R2ObjectStorage } from "./r2-object-storage";

// trim: un espacio o salto de linea pegado con la clave en Render la dana ("Credential access key has length 65").
const r2 = {
  accountId: env.R2_ACCOUNT_ID.trim(),
  accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
  secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim(),
  bucket: env.R2_BUCKET.trim(),
};
const r2Vars = Object.values(r2);

if (r2Vars.some(Boolean) && !r2Vars.every(Boolean)) {
  // A medio configurar seria peor que no configurado: las fotos nuevas fallarian. Se avisa y se sigue en la base.
  console.warn("[storage] Faltan variables R2_* (hacen falta las 4): las fotos se siguen guardando en la base.");
}

if (r2.accessKeyId && r2.accessKeyId.length !== 32) {
  console.warn(`[storage] R2_ACCESS_KEY_ID tiene ${r2.accessKeyId.length} caracteres y R2 pide 32: revise que no este cruzada con R2_SECRET_ACCESS_KEY (64).`);
}

/** Cloudflare R2 si estan las 4 variables R2_*; si no, null (las fotos se guardan en la base). */
export const objectStorage: IObjectStorage | null = r2Vars.every(Boolean)
  ? new R2ObjectStorage(r2)
  : null;
