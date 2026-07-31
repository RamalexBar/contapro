import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { ApiError } from "../../../lib/api-client";
import { loginPlatformAdmin } from "../api/saas-admin.api";
import { usePlatformAuthStore } from "../hooks/usePlatformAuthStore";

export function PlatformAdminLoginPage() {
  const navigate = useNavigate();
  const setSession = usePlatformAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("platform@demo.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginPlatformAdmin({ email, password });
      setSession(result.accessToken, result.platformAdmin);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Panel Administrador SaaS</h1>
        <p className="mb-6 text-sm text-gray-500">Acceso de operador de plataforma</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-gray-400">Demo: platform@demo.com — contraseña Demo1234!</p>
      </Card>
    </div>
  );
}
