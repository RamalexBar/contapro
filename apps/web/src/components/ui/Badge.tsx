import type { PropsWithChildren } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-brand-50 text-brand-700",
};

/** Pildora de estado -- reemplaza el texto plano que hoy usa cada pagina para mostrar status
 * (OPEN/CLOSED, PENDING/PAID, DRAFT/APPROVED, etc.). El caller decide el `tone` segun su propio
 * mapeo de estado -> color (los estados varian demasiado entre modulos para tokenizarlos todos
 * aca). */
export function Badge({ tone = "neutral", children }: PropsWithChildren<{ tone?: Tone }>) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>{children}</span>
  );
}
