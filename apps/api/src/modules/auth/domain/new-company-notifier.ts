export interface NewCompanyNotification {
  companyName: string;
  nit: string;
  companyEmail: string;
  adminFullName: string;
  adminEmail: string;
}

/** Aviso interno ("alguien se acaba de registrar") -- distinto de IPasswordResetNotifier, que le
 * habla al usuario final. `send` debe LANZAR si el envio falla, mismo criterio que
 * IPasswordResetNotifier: el caller (RegisterCompanyUseCase) lo envuelve en try/catch y solo
 * loguea, nunca bloquea el registro por esto. */
export interface INewCompanyNotifier {
  send(notification: NewCompanyNotification): Promise<void>;
}
