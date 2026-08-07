import { WhatsAppCloudApiSender } from "./infrastructure/whatsapp-cloud-api-sender";
import { PrismaWhatsAppDeliveryLogRepository } from "./infrastructure/prisma-whatsapp-delivery-log.repository";
import type { IWhatsAppSender } from "./domain/whatsapp-sender.port";
import type { IWhatsAppDeliveryLogRepository } from "./domain/whatsapp-delivery-log.repository";

/** Importado por electronic-invoicing/payroll/collections/saas-admin -- mismo patron de reuso
 * cross-modulo de toda la sesion (el modulo generico nunca importa hacia modulos de dominio). */
export const whatsAppSender: IWhatsAppSender = new WhatsAppCloudApiSender();
export const whatsAppDeliveryLogRepo: IWhatsAppDeliveryLogRepository = new PrismaWhatsAppDeliveryLogRepository();
