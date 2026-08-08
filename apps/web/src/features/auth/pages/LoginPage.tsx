import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Logo } from "../../../components/ui/Logo";
import { login } from "../api/auth.api";
import { useAuthStore } from "../hooks/useAuthStore";
import { ApiError } from "../../../lib/api-client";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login({ email, password });
      setSession(result.accessToken, result.refreshToken, result.user);
      navigate("/dashboard");
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
          <h1 className="mb-1 text-lg font-semibold text-slate-900">Ingresa a tu empresa</h1>
          <p className="mb-6 text-sm text-slate-500">Contabilidad, facturación y punto de venta en un solo lugar.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div>
              <Input label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Link to="/forgot-password" className="mt-1 block text-right text-xs font-medium text-brand-700 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            No tenes cuenta?{" "}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              Crea una gratis
            </Link>
          </p>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin@demo.com / cajero@demo.com — contraseña Demo1234!
        </p>
      </div>
    </div>
  );
}
