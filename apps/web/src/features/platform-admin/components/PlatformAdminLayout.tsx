import type { PropsWithChildren } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatformAuthStore } from "../hooks/usePlatformAuthStore";
import { Button } from "../../../components/ui/Button";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/plans", label: "Planes" },
  { to: "/admin/subscriptions", label: "Suscripciones" },
  { to: "/admin/companies", label: "Empresas" },
];

/** Layout separado de AppLayout (modules/auth) -- este panel no comparte autenticacion ni marca
 * visual con el resto de la app (ver README de saas-admin: PlatformAdmin no es un User). */
export function PlatformAdminLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const platformAdmin = usePlatformAuthStore((s) => s.platformAdmin);
  const clearSession = usePlatformAuthStore((s) => s.clearSession);

  function handleLogout() {
    clearSession();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4">
            <span className="font-semibold text-white">ERP · Plataforma</span>
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className="text-sm text-gray-300 hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{platformAdmin?.fullName}</span>
            <Button variant="secondary" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
