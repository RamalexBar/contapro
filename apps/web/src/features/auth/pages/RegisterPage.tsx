import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { login, registerCompany } from "../api/auth.api";
import { useAuthStore } from "../hooks/useAuthStore";
import { ApiError } from "../../../lib/api-client";

interface FormState {
  companyName: string;
  legalName: string;
  nit: string;
  companyEmail: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  legalName: "",
  nit: "",
  companyEmail: "",
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
};

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // branchName no se pide en el formulario (menos campos = mas facil de llenar) -- el
      // backend igual lo exige explicito porque RegisterCompanyInput se infiere del schema zod
      // con .default() aplicado, que zod resuelve en el output pero no hace opcional el tipo.
      await registerCompany({ ...form, branchName: "Sucursal principal" });
      // El registro no devuelve sesion (solo ids) -- se loguea aparte con las mismas
      // credenciales para llevar al usuario directo al Dashboard, sin que tenga que volver a
      // escribir el correo/contraseña que acaba de elegir.
      const result = await login({ email: form.adminEmail, password: form.adminPassword });
      setSession(result.accessToken, result.refreshToken, result.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Crear tu cuenta en Contapro</h1>
        <p className="mb-6 text-sm text-gray-500">30 dias de prueba gratis, sin tarjeta de credito.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre comercial"
            placeholder="Minimarket La Esquina"
            value={form.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            required
          />
          <Input
            label="Razon social"
            placeholder="Minimarket La Esquina S.A.S."
            value={form.legalName}
            onChange={(e) => update("legalName", e.target.value)}
            required
          />
          <Input label="NIT" placeholder="900123456-7" value={form.nit} onChange={(e) => update("nit", e.target.value)} required />
          <Input
            label="Correo de la empresa"
            type="email"
            placeholder="contacto@tuempresa.com"
            value={form.companyEmail}
            onChange={(e) => update("companyEmail", e.target.value)}
            required
          />
          <hr className="border-gray-200" />
          <Input
            label="Tu nombre completo"
            value={form.adminFullName}
            onChange={(e) => update("adminFullName", e.target.value)}
            required
          />
          <Input
            label="Tu correo (sera tu usuario)"
            type="email"
            value={form.adminEmail}
            onChange={(e) => update("adminEmail", e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            minLength={8}
            value={form.adminPassword}
            onChange={(e) => update("adminPassword", e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          Ya tenes cuenta?{" "}
          <Link to="/login" className="text-brand-700 hover:underline">
            Ingresa aqui
          </Link>
        </p>
      </Card>
    </div>
  );
}
