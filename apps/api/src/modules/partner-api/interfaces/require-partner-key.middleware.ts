import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env";
import type { Partner } from "../domain/partner-account.repository";

const KEYS: Record<Partner, () => string> = { CAJAPRO: () => env.CAJAPRO_PARTNER_KEY };

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Authorization: Bearer <llave del aliado>. Sin la variable de entorno la entrada queda cerrada. */
export function requirePartnerKey(partner: Partner) {
  return (req: Request, res: Response, next: NextFunction) => {
    const expected = KEYS[partner]();
    if (!expected) {
      return res.status(503).json({ error: "PARTNER_NOT_CONFIGURED", message: `La conexion con ${partner} no esta configurada en Contapro (falta ${partner}_PARTNER_KEY)` });
    }
    const header = req.headers.authorization ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!given || !timingSafeEqual(digest(given), digest(expected))) {
      return res.status(401).json({ error: "INVALID_PARTNER_KEY", message: "Llave del aliado invalida" });
    }
    next();
  };
}
