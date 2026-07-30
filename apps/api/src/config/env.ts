import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // ---- Facturacion electronica DIAN (ver modules/electronic-invoicing/README.md) ----
  // Vacios por defecto: sin estos 3 valores (asignados por la DIAN al registrar el software
  // durante la habilitacion) el envio real a la DIAN queda deshabilitado, pero el sistema
  // igual genera el CUFE y el XML localmente para revision/pruebas.
  DIAN_ENVIRONMENT: z.enum(["HABILITACION", "PRODUCCION"]).default("HABILITACION"),
  DIAN_SOFTWARE_ID: z.string().default(""),
  DIAN_SOFTWARE_PIN: z.string().default(""),
  DIAN_TECHNICAL_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno invalidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuracion de entorno invalida. Revisa apps/api/.env contra .env.example");
}

export const env = parsed.data;
