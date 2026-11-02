import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Logo } from "../../../components/ui/Logo";
import { Spinner } from "../../../components/ui/Spinner";
import { ApiError } from "../../../lib/api-client";
import { loginWithLink } from "../api/auth.api";
import { useAuthStore } from "../hooks/useAuthStore";

/**
 * «Entrar a Contapro» desde Cajapro: el enlace trae un token de un solo uso en la parte `#` (no llega a ningún
 * servidor ni queda en el historial: se borra al leerlo). Se cambia por una sesión normal y entra al tablero,
 * sin escribir correo ni clave.
 */
export function EnterWithLinkPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  // En desarrollo React monta dos veces: el token solo sirve una vez
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    window.history.replaceState(null, "", "/entrar");
    if (!token) {
      setError("Este enlace no es válido. Vuelva a Cajapro y toque «Entrar a Contapro».");
      return;
    }
    loginWithLink(token)
      .then((r) => {
        setSession(r.accessToken, r.refreshToken, r.user);
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error de conexión"));
  }, [navigate, setSession]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo heightClassName="h-14" />
        </div>
        <Card>
          {!error ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Spinner /> Entrando a su contabilidad…
            </div>
          ) : (
            <>
              <Alert tone="danger">{error}</Alert>
              <p className="mt-4 text-center text-sm text-slate-500">
                También puede{" "}
                <Link to="/login" className="font-medium text-brand-700 hover:underline">
                  entrar con su correo y clave
                </Link>
                .
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
