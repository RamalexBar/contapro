import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Logo } from "../../../components/ui/Logo";
import { login, registerCompany } from "../api/auth.api";
import { useAuthStore } from "../hooks/useAuthStore";
import { ApiError } from "../../../lib/api-client";
import { trackEvent } from "../../../lib/analytics";

// Solo 5 campos: la razon social arranca igual al nombre del negocio y el correo de la empresa
// igual al del usuario; ambos se corrigen despues en la configuracion de la empresa.
interface FormState {
  companyName: string;
  nit: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  nit: "",
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
    let companyId: string;
    try {
      // branchName no se pide en el formulario (menos campos = mas facil de llenar) -- el
      // backend igual lo exige explicito porque RegisterCompanyInput se infiere del schema zod
      // con .default() aplicado, que zod resuelve en el output pero no hace opcional el tipo.
      companyId = (
        await registerCompany({
          ...form,
          legalName: form.companyName,
          companyEmail: form.adminEmail,
          branchName: "Sucursal principal",
        })
      ).companyId;
      trackEvent("sign_up", { method: "email" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de conexion");
      setLoading(false);
      return;
    }
    try {
      // El registro no devuelve sesion (solo ids) -- se loguea aparte con las mismas
      // credenciales para llevar al usuario directo al Dashboard, sin que tenga que volver a
      // escribir el correo/contraseña que acaba de elegir. Se pasa companyId explicito (ya lo
      // conocemos, se acaba de crear) para que el login nunca dispare MultipleCompaniesError
      // aunque el email ya exista en otra empresa -- si aun asi este paso falla, la cuenta YA
      // se creo bien; no se debe mostrar un error que sugiera que el registro fallo.
      const result = await login({ email: form.adminEmail, password: form.adminPassword, companyId });
      setSession(result.accessToken, result.refreshToken, result.user);
      navigate("/dashboard");
    } catch {
      navigate("/login", { state: { registeredEmail: form.adminEmail } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo heightClassName="h-14" />
        </div>
        <Card>
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Crear tu cuenta</h1>
        <p className="mb-6 text-sm text-slate-500">14 días de prueba gratis, sin tarjeta de crédito. Toma menos de un minuto.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de tu negocio"
            placeholder="Muebles La Esquina"
            value={form.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            required
          />
          <Input
            label="NIT o cédula"
            placeholder="900123456-7"
            value={form.nit}
            onChange={(e) => update("nit", e.target.value)}
            required
          />
          <Input
            label="Tu nombre completo"
            value={form.adminFullName}
            onChange={(e) => update("adminFullName", e.target.value)}
            required
          />
          <Input
            label="Tu correo (será tu usuario)"
            type="email"
            value={form.adminEmail}
            onChange={(e) => update("adminEmail", e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            minLength={8}
            hint="Mínimo 8 caracteres"
            value={form.adminPassword}
            onChange={(e) => update("adminPassword", e.target.value)}
            required
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Ingresa aquí
          </Link>
        </p>
        </Card>
      </div>
    </div>
  );
}
