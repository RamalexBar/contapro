import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Logo } from "../../../components/ui/Logo";
import { resetPassword } from "../api/auth.api";
import { ApiError } from "../../../lib/api-client";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
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
          <Logo className="h-14" />
        </div>
        <Card>
          <h1 className="mb-1 text-lg font-semibold text-slate-900">Elegi una nueva contraseña</h1>
          <p className="mb-6 text-sm text-slate-500">Minimo 8 caracteres.</p>

          {!token && <Alert tone="danger">Este enlace no es valido. Solicita uno nuevo desde la pantalla de login.</Alert>}

          {token && done && <Alert tone="success">Contraseña actualizada. Redirigiendo al login...</Alert>}

          {token && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nueva contraseña"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" className="w-full" loading={loading}>
                Cambiar contraseña
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
