import type { PropsWithChildren } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { Button } from "./Button";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/products", label: "Inventario" },
  { to: "/pos", label: "Punto de venta" },
  { to: "/cash", label: "Caja" },
  { to: "/employees", label: "Empleados", permissions: ["employee.read"] },
  { to: "/payroll", label: "Nomina", permissions: ["payroll.read"] },
  { to: "/timetracking", label: "Horarios", permissions: ["timetracking.clock", "timetracking.read"] },
];

export function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4">
            <span className="font-semibold text-brand-700">ERP</span>
            {NAV_ITEMS.filter((item) => !item.permissions || item.permissions.some(hasPermission)).map((item) => (
              <Link key={item.to} to={item.to} className="text-sm text-gray-600 hover:text-brand-700">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.fullName}</span>
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
