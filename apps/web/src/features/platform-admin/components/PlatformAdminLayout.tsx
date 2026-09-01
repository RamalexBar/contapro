import type { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { usePlatformAuthStore } from "../hooks/usePlatformAuthStore";
import { Button } from "../../../components/ui/Button";
import { Logo } from "../../../components/ui/Logo";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/plans", label: "Planes" },
  { to: "/admin/subscriptions", label: "Suscripciones" },
  { to: "/admin/companies", label: "Empresas" },
];

/** Layout separado de AppLayout (modules/auth) -- este panel no comparte autenticacion ni marca
 * visual con el resto de la app (ver README de saas-admin: PlatformAdmin no es un User). Se queda
 * con su propia barra superior oscura (deliberadamente distinta al sidebar del tenant, para que
 * un operador de plataforma nunca confunda en qué panel está) en vez de forzar un sidebar para
 * solo 4 links. */
export function PlatformAdminLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const platformAdmin = usePlatformAuthStore((s) => s.platformAdmin);
  const clearSession = usePlatformAuthStore((s) => s.clearSession);

  function handleLogout() {
    clearSession();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-semibold text-white">
              <Logo heightClassName="h-8" onDark />
              <span className="font-normal text-slate-400">· Plataforma</span>
            </span>
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{platformAdmin?.fullName}</span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
