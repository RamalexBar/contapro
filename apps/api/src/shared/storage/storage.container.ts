import { env } from "../../config/env";
import type { IObjectStorage } from "./object-storage";
import { R2ObjectStorage } from "./r2-object-storage";

const r2Vars = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET];

if (r2Vars.some(Boolean) && !r2Vars.every(Boolean)) {
  // A medio configurar seria peor que no configurado: las fotos nuevas fallarian. Se avisa y se sigue en la base.
  console.warn("[storage] Faltan variables R2_* (hacen falta las 4): las fotos se siguen guardando en la base.");
}

/** Cloudflare R2 si estan las 4 variables R2_*; si no, null (las fotos se guardan en la base). */
export const objectStorage: IObjectStorage | null = r2Vars.every(Boolean)
  ? new R2ObjectStorage({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    })
  : null;
