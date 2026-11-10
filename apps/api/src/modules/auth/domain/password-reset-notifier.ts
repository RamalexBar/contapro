export interface PasswordResetLink {
  companyName: string;
  resetUrl: string;
}

/** Un solo correo por solicitud. Si el email existe en varias empresas (es unico por empresa, no global), trae un
 * enlace por empresa: cada uno restablece solo la cuenta de esa empresa. */
export interface PasswordResetNotification {
  email: string;
  fullName: string;
  links: PasswordResetLink[];
}

export interface IPasswordResetNotifier {
  send(notification: PasswordResetNotification): Promise<void>;
}
