import { ListContactMessagesUseCase, SetContactMessageHandledUseCase, SubmitContactMessageUseCase } from "./application/use-cases/contact-messages.use-cases";
import { PrismaContactMessageRepository } from "./infrastructure/prisma-contact-message.repository";
import { ResendContactNotifier } from "./infrastructure/resend-contact-notifier";
import { ContactController } from "./interfaces/contact.controller";

const repo = new PrismaContactMessageRepository();

export const contactController = new ContactController(
  new SubmitContactMessageUseCase(repo, new ResendContactNotifier()),
  new ListContactMessagesUseCase(repo),
  new SetContactMessageHandledUseCase(repo)
);
