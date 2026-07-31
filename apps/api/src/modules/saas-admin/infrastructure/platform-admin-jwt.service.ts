import jwt from "jsonwebtoken";
import { env } from "../../../config/env";

export interface PlatformAdminTokenPayload {
  sub: string; // platformAdminId
}

/** Secreto SEPARADO de signAccessToken (modules/auth) -- ver aviso en config/env.ts. */
export function signPlatformAdminToken(payload: PlatformAdminTokenPayload): string {
  return jwt.sign(payload, env.JWT_PLATFORM_ADMIN_SECRET, {
    expiresIn: env.JWT_PLATFORM_ADMIN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyPlatformAdminToken(token: string): PlatformAdminTokenPayload {
  return jwt.verify(token, env.JWT_PLATFORM_ADMIN_SECRET) as unknown as PlatformAdminTokenPayload;
}
