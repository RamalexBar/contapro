import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  // min(32): un secreto HS256 corto es fuerza-bruteable offline si se filtra algun token
  // firmado. 10 caracteres (limite anterior) dejaba pasar secretos como "admin123456" sin que
  // la validacion se quejara -- 32 no garantiza entropia real (un string de 32 caracteres
  // repetidos tambien pasa), pero exige generar los secretos con un CSPRNG en vez de escribir
  // algo corto a mano, ej.: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  // Secreto SEPARADO del de usuarios de empresa (JWT_ACCESS_SECRET) -- un token de plataforma
  // (PlatformAdmin, ver modules/saas-admin/README.md) nunca debe poder reusarse como token de
  // empresa ni viceversa.
  JWT_PLATFORM_ADMIN_SECRET: z.string().min(32),
  JWT_PLATFORM_ADMIN_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // ---- Facturacion electronica DIAN (ver modules/electronic-invoicing/README.md) ----
  // Vacios por defecto: sin estos 3 valores (asignados por la DIAN al registrar el software
  // durante la habilitacion) el envio real a la DIAN queda deshabilitado, pero el sistema
  // igual genera el CUFE y el XML localmente para revision/pruebas.
  DIAN_ENVIRONMENT: z.enum(["HABILITACION", "PRODUCCION"]).default("HABILITACION"),
  DIAN_SOFTWARE_ID: z.string().default(""),
  DIAN_SOFTWARE_PIN: z.string().default(""),
  DIAN_TECHNICAL_KEY: z.string().default(""),
  // Firma XAdES + envio SOAP (ver modules/electronic-invoicing/README.md): vacio por defecto
  // = firma deshabilitada, se sigue generando CUFE/XML local igual que sin estas 3 variables.
  DIAN_CERTIFICATE_PATH: z.string().default(""),
  DIAN_CERTIFICATE_PASSWORD: z.string().default(""),
  // URL del servicio SOAP de la DIAN -- SIN VERIFICAR, no se precarga una URL de la DIAN por
  // defecto (ver dian-soap-client.ts). Vacio = el envio real fallará (esperado sin credenciales).
  DIAN_SOAP_ENDPOINT: z.string().default(""),
  // Nomina electronica usa un servicio DIAN SEPARADO al de facturacion -- ver
  // dian-nomina-soap-client.ts. SIN VERIFICAR (mas incluso que DIAN_SOAP_ENDPOINT).
  DIAN_NOMINA_SOAP_ENDPOINT: z.string().default(""),

  // ---- Recordatorios de vencimiento de suscripcion (ver modules/saas-admin/README.md) ----
  // Vacio por defecto = envio real deshabilitado (RunSubscriptionLifecycleUseCase no marca el
  // recordatorio como enviado y lo reintenta en el siguiente ciclo del poller), mismo criterio
  // que las variables DIAN_* de arriba.
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("no-reply@erp-saas.demo"),

  // ---- Cobro de suscripciones via Wompi/Bancolombia (ver modules/saas-admin/README.md) ----
  // Vacios por defecto = generar un link de cobro falla con mensaje claro (mismo criterio que
  // las variables DIAN_*/RESEND_* de arriba, no un crash silencioso). WOMPI_PRIVATE_KEY no lo usa
  // el flujo actual (Web Checkout + webhook no requieren llamar la API de Wompi desde el
  // backend), se deja preparado para una futura reconciliacion manual (GET /v1/transactions/:id).
  WOMPI_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  WOMPI_PUBLIC_KEY: z.string().default(""),
  WOMPI_PRIVATE_KEY: z.string().default(""),
  WOMPI_INTEGRITY_SECRET: z.string().default(""),
  WOMPI_EVENTS_SECRET: z.string().default(""),

  // ---- WhatsApp Business Cloud API, Meta (ver modules/whatsapp/README.md) ----
  // Vacios por defecto = envio real deshabilitado (mismo criterio que DIAN_*/RESEND_*/WOMPI_*
  // de arriba): el envio de documentos/recordatorios por WhatsApp falla con mensaje claro y,
  // segun el flujo, o queda auditado como fallo (documentos) o cae automaticamente a email
  // (recordatorios) -- nunca un crash silencioso.
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),

  // ---- Lectura automatica de facturas de compra con IA (ver modules/suppliers/README.md) ----
  // Vacio por defecto = POST /purchases/extract falla con mensaje claro (mismo criterio que
  // DIAN_*/RESEND_*/WOMPI_*/WHATSAPP_* de arriba). Nunca se usa para nada mas que extraer datos
  // de la imagen/PDF que el propio usuario sube -- el registro de la compra sigue siendo manual
  // (POST /purchases), esto solo prellena el formulario.
  ANTHROPIC_API_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno invalidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuracion de entorno invalida. Revisa apps/api/.env contra .env.example");
}

export const env = parsed.data;
