import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Logo } from "../../../components/ui/Logo";
import { login } from "../api/auth.api";
import { useAuthStore } from "../hooks/useAuthStore";
import { ApiError } from "../../../lib/api-client";

interface CompanyMatch {
  companyId: string;
  companyName: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail = (location.state as { registeredEmail?: string } | null)?.registeredEmail;
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState(registeredEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // El mismo email puede existir en mas de una empresa (unico solo POR empresa, ver
  // User.@@unique([companyId, email])) -- si el backend responde MULTIPLE_COMPANIES, se muestra
  // este selector en vez de reintentar a ciegas, y el siguiente submit manda companyId explicito.
  const [companyChoices, setCompanyChoices] = useState<CompanyMatch[] | null>(null);
  const [companyId, setCompanyId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login({ email, password, companyId: companyId || undefined });
      setSession(result.accessToken, result.refreshToken, result.user);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "MULTIPLE_COMPANIES") {
        const companies = (err.details as { companies?: CompanyMatch[] } | undefined)?.companies ?? [];
        setCompanyChoices(companies);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : "Error de conexion");
      }
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
          {registeredEmail && (
            <Alert tone="success" className="mb-4">
              Tu cuenta se creó correctamente. Ingresa con tu contraseña para continuar.
            </Alert>
          )}
          {companyChoices ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600">
                Tu correo esta registrado en mas de una empresa. Elige con cual quieres ingresar:
              </p>
              <Select label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {companyChoices.map((c) => (
                  <option key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" className="w-full" loading={loading} disabled={!companyId}>
                {loading ? "Ingresando..." : "Continuar"}
              </Button>
              <button
                type="button"
                className="block text-center text-xs text-slate-500 hover:underline"
                onClick={() => {
                  setCompanyChoices(null);
                  setCompanyId("");
                }}
              >
                Volver
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Correo"
                type="email"
                placeholder="tucorreo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div>
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Link to="/forgot-password" className="mt-1 block text-right text-xs font-medium text-brand-700 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" className="w-full" loading={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          )}
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
