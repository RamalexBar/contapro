import { env } from "../../config/env";

/**
 * Avisos al equipo de Contapro cuando algo falla sin que nadie lo vea (un error interno, un cobro
 * automatico rechazado, un proceso de fondo caido). Antes solo quedaba en el log del servidor.
 */
export interface IOperationalAlerts {
  /** `key` agrupa el mismo problema: se avisa una vez cada 6 horas por key, no en cada repeticion. */
  send(key: string, subject: string, detail: string): void;
}

type Transport = (subject: string, detail: string) => Promise<void>;

const REPEAT_MS = 6 * 60 * 60 * 1000;
const MAX_PER_HOUR = 20;

/** Correo por Resend a INTERNAL_NOTIFICATIONS_EMAIL (el mismo del aviso de pagos). Sin esas variables no envia nada. */
async function resendTransport(subject: string, detail: string) {
  if (!env.INTERNAL_NOTIFICATIONS_EMAIL || !env.RESEND_API_KEY) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: env.INTERNAL_NOTIFICATIONS_EMAIL,
      subject: `[Contapro] ${subject}`,
      text: `${detail}\n\nEste aviso no se repite por el mismo problema en las próximas 6 horas. El detalle completo está en los logs de contapro-api en Render.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend respondio ${res.status}: ${await res.text().catch(() => "")}`);
}

export class OperationalAlerts implements IOperationalAlerts {
  private readonly lastSent = new Map<string, number>();
  private sentThisHour: number[] = [];

  constructor(
    private readonly transport: Transport = resendTransport,
    private readonly now: () => number = Date.now
  ) {}

  send(key: string, subject: string, detail: string): void {
    console.error(`[alerta] ${subject}: ${detail}`);
    const now = this.now();
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < REPEAT_MS) return;
    // Tope por si algo falla en cadena: nunca mas de 20 correos por hora
    this.sentThisHour = this.sentThisHour.filter((t) => now - t < 60 * 60 * 1000);
    if (this.sentThisHour.length >= MAX_PER_HOUR) return;

    this.lastSent.set(key, now);
    this.sentThisHour.push(now);
    // Nunca frena lo que se estaba haciendo: si el correo falla, queda en el log
    this.transport(subject, detail.slice(0, 4000)).catch((err) => console.error("[alerta] no se pudo enviar el correo:", err));
  }
}

export const operationalAlerts: IOperationalAlerts = new OperationalAlerts();

/** Mensaje y pila de un error cualquiera, para el detalle del aviso. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  return String(err);
}
