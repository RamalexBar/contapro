import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Logo } from "../../../components/ui/Logo";
import { forgotPassword } from "../api/auth.api";
import { ApiError } from "../../../lib/api-client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo iconClassName="h-14" textSizeClass="text-2xl" />
        </div>
        <Card>
          <h1 className="mb-1 text-lg font-semibold text-slate-900">Recuperar contraseña</h1>
          <p className="mb-6 text-sm text-slate-500">Te enviamos un enlace a tu correo para elegir una nueva.</p>

          {sent ? (
            <Alert tone="success">
              Si el correo <strong>{email}</strong> esta registrado, te enviamos un enlace para restablecer tu
              contraseña. Revisa tu bandeja de entrada (y spam).
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" className="w-full" loading={loading}>
                Enviar enlace
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-slate-500">
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Volver a iniciar sesion
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
