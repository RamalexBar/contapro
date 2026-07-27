import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SALT_ROUNDS = 10;

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
