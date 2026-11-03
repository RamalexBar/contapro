/** Un mensaje del formulario de contacto de contapro.com.co (una persona interesada, todavia sin empresa). */
export interface ContactMessageRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string;
  source: string;
  createdAt: Date;
  handledAt: Date | null;
  handledBy: string | null;
}

export interface NewContactMessage {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string;
  source: string;
  ipAddress: string | null;
}

export interface IContactMessageRepository {
  create(data: NewContactMessage): Promise<ContactMessageRecord>;
  list(limit: number): Promise<ContactMessageRecord[]>;
  /** Marca o desmarca como atendido; false si el mensaje no existe. */
  setHandled(id: string, handledBy: string | null): Promise<boolean>;
}

/** Aviso al equipo de Contapro (correo); nunca debe frenar que el mensaje quede guardado. */
export interface IContactNotifier {
  notifyNewMessage(message: ContactMessageRecord): Promise<void>;
}
