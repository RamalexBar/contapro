import { basePrisma } from "@erp/database";
import type { IContactMessageRepository, NewContactMessage } from "../domain/contact-message.repository";

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  message: true,
  source: true,
  createdAt: true,
  handledAt: true,
  handledBy: true,
} as const;

/** basePrisma: los mensajes no son de ninguna empresa (llegan antes de que la persona se registre). */
export class PrismaContactMessageRepository implements IContactMessageRepository {
  async create(data: NewContactMessage) {
    return basePrisma.contactMessage.create({ data, select: SELECT });
  }

  async list(limit: number) {
    return basePrisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: SELECT });
  }

  async setHandled(id: string, handledBy: string | null) {
    const { count } = await basePrisma.contactMessage.updateMany({
      where: { id },
      data: { handledAt: handledBy ? new Date() : null, handledBy },
    });
    return count === 1;
  }
}
