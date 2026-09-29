import { useState } from "react";
import { Mail, MessageCircle, X } from "lucide-react";

const WHATSAPP_NUMBER = "573008453690"; // 57 = Colombia, sin espacios/guiones para el link wa.me
const EMAIL = "contaprocontabilidad@gmail.com";
const INSTAGRAM_HANDLE = "contaprocontabilidad";

function InstagramIcon({ size }: { size: number }) {
  // lucide-react no trae iconos de marcas (ver dist/esm/icons) -- trazo generico del glifo de
  // Instagram (cuadrado redondeado + circulo + punto), sin usar su wordmark/logotipo.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/** Botón flotante persistente (abajo a la derecha) con los 3 canales de contacto reales de
 * Contapro -- montado una sola vez en RootLayout.tsx para que aparezca en toda la landing y la
 * app (pero no en el panel de plataforma /admin/*, ver ese layout). */
export function ContactWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contáctanos</p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
              <MessageCircle size={16} />
            </span>
            WhatsApp: 300 845 3690
          </a>
          <a
            href={`mailto:${EMAIL}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Mail size={16} />
            </span>
            {EMAIL}
          </a>
          <a
            href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600">
              <InstagramIcon size={16} />
            </span>
            @{INSTAGRAM_HANDLE}
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar contacto" : "Contáctanos"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-success-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-success-700"
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
}
