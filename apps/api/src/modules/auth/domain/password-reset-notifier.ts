export interface PasswordResetNotification {
  email: string;
  fullName: string;
  resetUrl: string;
}

export interface IPasswordResetNotifier {
  send(notification: PasswordResetNotification): Promise<void>;
}
