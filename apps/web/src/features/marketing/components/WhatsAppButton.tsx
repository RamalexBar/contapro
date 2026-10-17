import { trackEvent } from "../../../lib/analytics";

// Numero en formato internacional sin "+" ni espacios (ej. 573001234567). Sin numero configurado
// el boton no se muestra.
const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, "") ?? "";
const DEFAULT_MESSAGE = "Hola, vi Contapro y quiero saber más.";

export const hasWhatsApp = WHATSAPP_NUMBER.length > 0;

export function whatsAppUrl(message = DEFAULT_MESSAGE): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Abre WhatsApp y registra el clic en Analytics (evento "contact_whatsapp"). */
export function WhatsAppLink({
  placement,
  message,
  className,
  children,
}: {
  placement: string;
  message?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!hasWhatsApp) return null;
  return (
    <a
      href={whatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => trackEvent("contact_whatsapp", { placement })}
    >
      {children}
    </a>
  );
}
