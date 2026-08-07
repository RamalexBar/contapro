import type { PropsWithChildren } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  info: "bg-brand-50 text-brand-700 border-brand-200",
  success: "bg-success-50 text-success-700 border-success-200",
  warning: "bg-warning-50 text-warning-700 border-warning-200",
  danger: "bg-danger-50 text-danger-700 border-danger-200",
};

const TONE_ICONS: Record<Tone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/** Reemplaza los banners de aviso/error armados a mano en cada pagina (bg-yellow-50 px-3 py-2
 * text-sm text-yellow-700, con variantes distintas segun la pagina). */
export function Alert({ tone = "info", className = "", children }: PropsWithChildren<{ tone?: Tone; className?: string }>) {
  const Icon = TONE_ICONS[tone];
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${TONE_CLASSES[tone]} ${className}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
