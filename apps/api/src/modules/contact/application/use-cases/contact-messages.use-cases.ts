import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { ContactMessageRecord, IContactMessageRepository, IContactNotifier, NewContactMessage } from "../../domain/contact-message.repository";

/**
 * Formulario de contacto de la pagina de inicio: el mensaje se guarda (queda en el panel de plataforma) y le llega por
 * correo al equipo, con «responder a» el correo de la persona. Si el correo falla, el mensaje igual queda guardado.
 */
export class SubmitContactMessageUseCase {
  constructor(
    private readonly repo: IContactMessageRepository,
    private readonly notifier: IContactNotifier,
    private readonly log: (msg: string, err: unknown) => void = (msg, err) => console.error(msg, err)
  ) {}

  async execute(input: NewContactMessage): Promise<ContactMessageRecord> {
    if (!input.email && !input.phone) throw new ValidationError("Deje un correo o un celular para poder responderle");
    const saved = await this.repo.create(input);
    try {
      await this.notifier.notifyNewMessage(saved);
    } catch (err) {
      this.log("[contact] el mensaje quedo guardado pero no se pudo enviar el correo:", err);
    }
    return saved;
  }
}

export class ListContactMessagesUseCase {
  constructor(private readonly repo: IContactMessageRepository) {}
  execute(): Promise<ContactMessageRecord[]> {
    return this.repo.list(200);
  }
}

/** Marcar (o desmarcar) un mensaje como atendido desde el panel. */
export class SetContactMessageHandledUseCase {
  constructor(private readonly repo: IContactMessageRepository) {}
  async execute(id: string, handled: boolean, platformAdminId: string): Promise<void> {
    if (!(await this.repo.setHandled(id, handled ? platformAdminId : null))) throw new NotFoundError("Mensaje");
  }
}
