import { useState, type FormEvent } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import { EMAIL, WHATSAPP_NUMBER } from "../../../components/ui/ContactWidget";
import { apiFetch, ApiError } from "../../../lib/api-client";
import { trackEvent } from "../../../lib/analytics";

/**
 * «¿Tienes preguntas?» de la pagina de inicio: el mensaje le llega al equipo por correo y queda en el panel de
 * plataforma → Mensajes. Al lado, el WhatsApp y el correo visibles (dan confianza: hay personas detras).
 */
export function ContactForm() {
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Déjanos un correo o un celular para poder responderte.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiFetch("/contact-messages", { method: "POST", body: { ...form, source: "landing" }, retry: false });
      trackEvent("contact_form", { placement: "landing" });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar. Escríbenos por WhatsApp.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="contacto" className="border-t border-slate-100 bg-slate-50 px-4 py-16">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">¿Tienes preguntas?</h2>
          <p className="mt-2 text-slate-600">Escríbenos y te respondemos el mismo día hábil. También puedes hablar con nosotros directamente:</p>
          <div className="mt-6 space-y-3 text-sm">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("contact_whatsapp", { placement: "contact_section" })}
              className="flex items-center gap-3 text-slate-700 hover:text-brand-700"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-50 text-success-600">
                <MessageCircle size={18} />
              </span>
              WhatsApp: +57 {WHATSAPP_NUMBER.slice(2, 5)} {WHATSAPP_NUMBER.slice(5, 8)} {WHATSAPP_NUMBER.slice(8)}
            </a>
            <a href={`mailto:${EMAIL}`} className="flex items-center gap-3 text-slate-700 hover:text-brand-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Mail size={18} />
              </span>
              {EMAIL}
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {sent ? (
            <Alert tone="success">¡Gracias! Recibimos tu mensaje y te contactamos pronto.</Alert>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Tu nombre" value={form.name} onChange={set("name")} required minLength={2} maxLength={120} />
                <Input label="Tu negocio (opcional)" value={form.company} onChange={set("company")} maxLength={120} />
                <Input label="Correo" type="email" value={form.email} onChange={set("email")} maxLength={160} />
                <Input label="Celular / WhatsApp" inputMode="tel" value={form.phone} onChange={set("phone")} maxLength={30} />
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">¿En qué te podemos ayudar?</span>
                <textarea
                  value={form.message}
                  onChange={set("message")}
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={4}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
              {/* Trampa para robots: oculto para las personas */}
              <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <p className="text-xs text-slate-500">Déjanos un correo o un celular para responderte. Usamos tus datos solo para contestar tu mensaje.</p>
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" loading={sending} className="w-full sm:w-auto">
                Enviar mensaje
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
