import { useState, type PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  Landmark,
  Menu,
  Package,
  Percent,
  Plug,
  Receipt,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Target,
  Truck,
  UserCircle,
  UserRound,
  Users,
  Wallet,
  Wallet2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { getOwnSubscription } from "../../features/billing/api/billing.api";
import { Button } from "./Button";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/** Agrupado por dominio de negocio -- antes era una sola fila horizontal de 26 links sin agrupar,
 * que desbordaba en pantallas normales. */
const NAV_SECTIONS: NavSection[] = [
  { label: "Principal", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Ventas",
    items: [
      { to: "/pos", label: "Punto de venta", icon: ShoppingCart },
      {
        to: "/quotes-notes",
        label: "Cotizaciones",
        icon: FileText,
        permissions: ["quote.create", "creditnote.create", "debitnote.create", "return.create", "sale.read"],
      },
      { to: "/cash", label: "Caja", icon: Wallet },
    ],
  },
  { label: "Inventario", items: [{ to: "/products", label: "Inventario", icon: Package }] },
  {
    label: "Contabilidad",
    items: [
      { to: "/accounting", label: "Contabilidad", icon: FileSpreadsheet, permissions: ["accounting.read"] },
      { to: "/accounting/banks", label: "Bancos", icon: Landmark, permissions: ["accounting.read"] },
      { to: "/accounting/exogena", label: "Exógena DIAN", icon: ScrollText, permissions: ["accounting.read"] },
    ],
  },
  {
    label: "Compras",
    items: [
      { to: "/suppliers", label: "Proveedores", icon: Truck, permissions: ["suppliers.read"] },
      { to: "/purchase-orders", label: "Órdenes de compra", icon: FileText, permissions: ["suppliers.read"] },
      { to: "/expenses", label: "Gastos", icon: Receipt, permissions: ["expense.read"] },
    ],
  },
  { label: "Cobranza", items: [{ to: "/collections", label: "Cuentas por cobrar", icon: Wallet2, permissions: ["collection.read"] }] },
  {
    label: "Nómina",
    items: [
      { to: "/employees", label: "Empleados", icon: Users, permissions: ["employee.read"] },
      { to: "/payroll", label: "Nómina", icon: Banknote, permissions: ["payroll.read"] },
      { to: "/timetracking", label: "Horarios", icon: Clock, permissions: ["timetracking.clock", "timetracking.read"] },
      { to: "/time-off", label: "Vacaciones", icon: CalendarDays, permissions: ["timeoff.request", "timeoff.manage", "timeoff.read"] },
    ],
  },
  {
    label: "Clientes",
    items: [
      { to: "/customers", label: "Clientes", icon: UserRound, permissions: ["customer.read"] },
      { to: "/crm", label: "Oportunidades", icon: Target, permissions: ["opportunity.read"] },
    ],
  },
  {
    label: "Otros",
    items: [
      { to: "/commissions", label: "Comisiones", icon: Percent, permissions: ["commission.read"] },
      { to: "/fixed-assets", label: "Activos fijos", icon: Building2, permissions: ["fixed-asset.read"] },
      { to: "/recurring-invoices", label: "Facturación recurrente", icon: FileText, permissions: ["recurring-invoice.read"] },
      { to: "/integrations", label: "Integraciones", icon: Plug, permissions: ["api-key.read", "webhook.read"] },
    ],
  },
  {
    label: "Configuración",
    items: [
      { to: "/rbac", label: "Roles y permisos", icon: ShieldCheck, permissions: ["rbac.manage"] },
      { to: "/audit", label: "Auditoría", icon: History, permissions: ["audit.read"] },
      { to: "/billing", label: "Mi suscripción", icon: CreditCard, permissions: ["billing.manage"] },
    ],
  },
];


/** Aviso corto dentro de la app cuando la suscripcion esta por vencer -- antes el unico
 * recordatorio era por correo (8/5/3/1/0 dias, ver saas-admin/README.md), asi que si el cliente
 * no revisaba el correo nunca se enteraba usando el sistema mismo. Solo lo ve quien administra la
 * suscripcion (`billing.manage`, mismo permiso que el link "Mi suscripcion" del sidebar) para no
 * alarmar a cajeros/empleados que no pueden hacer nada al respecto. */
function SubscriptionBanner() {
  const canManageBilling = useAuthStore((s) => s.hasPermission("billing.manage"));
  const { data } = useQuery({
    queryKey: ["own-subscription"],
    queryFn: getOwnSubscription,
    enabled: canManageBilling,
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;
  if (data.subscription.status !== "TRIALING" && data.subscription.status !== "ACTIVE") return null;

  const daysRemaining = Math.ceil((new Date(data.subscription.currentPeriodEnd).getTime() - Date.now()) / 86_400_000);
  if (daysRemaining > 3 || daysRemaining < 0) return null;

  const label =
    daysRemaining === 0
      ? "Tu suscripcion vence hoy"
      : `Tu suscripcion vence en ${daysRemaining} dia${daysRemaining === 1 ? "" : "s"}`;

  return (
    <div className={`flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white ${daysRemaining <= 1 ? "bg-danger-600" : "bg-warning-600"}`}>
      <span>{label}.</span>
      <NavLink to="/billing" className="underline hover:no-underline">
        Renovar ahora
      </NavLink>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => !item.permissions || item.permissions.some(hasPermission));
        if (visibleItems.length === 0) return null;
        return (
          <div key={section.label}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.label}</p>
            <div className="space-y-0.5">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <item.icon size={17} strokeWidth={2} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="no-print">
        <SubscriptionBanner />
      </div>
      <div className="flex min-h-0 flex-1">
      {/* Sidebar de escritorio -- siempre visible en md+. */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <Logo />
        </div>
        <SidebarContent />
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-1 text-sm font-medium text-slate-700">{user?.fullName}</p>
          <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </aside>

      {/* Sidebar movil -- overlay deslizante, oculto por defecto. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative flex w-72 max-w-[80vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 py-4 pl-4 pr-3">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            <div className="border-t border-slate-200 p-3">
              <p className="truncate px-1 text-sm font-medium text-slate-700">{user?.fullName}</p>
              <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={handleLogout}>
                Salir
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Antes el nombre del usuario logueado solo aparecia al fondo del sidebar de escritorio
            (facil de perder de vista) y ni siquiera en movil salvo que se abriera el menu -- esta
            barra queda visible siempre, arriba a la derecha, en ambos tamanos de pantalla. */}
        <header className="no-print flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <Logo />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <UserCircle size={20} className="text-slate-400" />
            <span className="max-w-[12rem] truncate">{user?.fullName}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      </div>
    </div>
  );
}
