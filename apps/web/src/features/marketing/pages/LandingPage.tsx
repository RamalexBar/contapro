import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Receipt,
  Calculator,
  Users,
  Boxes,
  Wallet,
  Smartphone,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Logo } from "../../../components/ui/Logo";

const FEATURES = [
  { icon: ShoppingCart, title: "POS y ventas", desc: "Punto de venta rápido, cotizaciones, notas crédito/débito y devoluciones." },
  { icon: Receipt, title: "Facturación electrónica DIAN", desc: "Factura, nota crédito/débito, documento soporte y nómina electrónica." },
  { icon: Calculator, title: "Contabilidad completa", desc: "Plan de cuentas, comprobantes automáticos, balance, estado de resultados y cierre de período." },
  { icon: Boxes, title: "Inventario con costeo real", desc: "FIFO, kardex, lotes, códigos de barra y listas de precios por cliente." },
  { icon: Wallet, title: "Nómina Colombia", desc: "Liquidación completa, festivos colombianos, deducciones y desprendible en PDF." },
  { icon: Users, title: "Multiempresa y roles", desc: "Múltiples sucursales, permisos por rol y auditoría de cada cambio." },
  { icon: Smartphone, title: "App móvil offline", desc: "Vende sin internet: sincroniza automáticamente al recuperar conexión." },
];

const COMPETITORS = [
  { name: "Siigo", price: "$145.993 – $191.327", note: "módulos separados" },
  { name: "Alegra", price: "$163.900 – $319.900", note: "nómina y POS aparte" },
  { name: "World Office", price: "$170.000 – $182.750", note: "nómina solo en el plan tope" },
];

const PLANS = [
  { code: "TRIAL", name: "Prueba gratuita", price: "$0", period: "14 días", branches: "1 sucursal", users: "3 usuarios", highlight: false },
  { code: "BASICO", name: "Plan Emprendedor", price: "$39.900", period: "/mes", branches: "1 sucursal", users: "3 usuarios", highlight: false },
  { code: "PYME", name: "Plan Pyme", price: "$79.900", period: "/mes", branches: "3 sucursales", users: "10 usuarios", highlight: true },
  { code: "PRO", name: "Plan Plus", price: "$149.900", period: "/mes", branches: "10 sucursales", users: "50 usuarios", highlight: false },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <nav className="flex items-center gap-3">
            <a href="#precios" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              Precios
            </a>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Ingresar
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Empezar gratis</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          El ERP todo-en-uno para tu negocio, a un precio que sí es de pyme
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Facturación electrónica DIAN, punto de venta, inventario, contabilidad y nómina — en un
          solo sistema, con un solo precio. Sin módulos separados, sin sorpresas.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register">
            <Button size="md" className="px-6 py-3 text-base">
              Empezar gratis 14 días
              <ArrowRight size={16} />
            </Button>
          </Link>
          <a href="#precios">
            <Button variant="secondary" size="md" className="px-6 py-3 text-base">
              Ver precios
            </Button>
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">Sin tarjeta de crédito para empezar.</p>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">Todo lo que tu negocio necesita, de fábrica</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativo */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900">La competencia cobra por partes. Nosotros no.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Siigo, Alegra y World Office venden facturación, contabilidad, POS y nómina como
            productos separados — el costo real termina 30-80% arriba del precio anunciado.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {COMPETITORS.map((c) => (
              <div key={c.name} className="rounded-xl border border-slate-200 p-5 text-left">
                <p className="text-sm font-semibold text-slate-500">{c.name}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{c.price}</p>
                <p className="mt-1 text-xs text-slate-400">{c.note} · COP/mes</p>
              </div>
            ))}
            <div className="rounded-xl border-2 border-brand-600 bg-brand-50 p-5 text-left">
              <p className="text-sm font-semibold text-brand-700">Contapro</p>
              <p className="mt-1 text-xl font-bold text-slate-900">$39.900 – $149.900</p>
              <p className="mt-1 text-xs text-brand-700">todo incluido · COP/mes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="precios" className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">Planes simples, todo el sistema incluido</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">
            La diferencia entre planes es cuánto creces (sucursales y usuarios), no qué módulos
            puedes usar. Todos incluyen POS, inventario, contabilidad, nómina y facturación DIAN.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.code}
                className={`rounded-xl border bg-white p-6 ${
                  p.highlight ? "border-2 border-brand-600 shadow-md" : "border-slate-200"
                }`}
              >
                {p.highlight && (
                  <span className="mb-2 inline-block rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Más popular
                  </span>
                )}
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <p className="mt-2">
                  <span className="text-2xl font-bold text-slate-900">{p.price}</span>{" "}
                  <span className="text-sm text-slate-500">{p.period}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-success-600" /> {p.branches}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-success-600" /> {p.users}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-success-600" /> Todos los módulos
                  </li>
                </ul>
                <Link to="/register" className="mt-6 block">
                  <Button variant={p.highlight ? "primary" : "secondary"} className="w-full">
                    Empezar
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Empieza gratis, sin tarjeta de crédito</h2>
        <p className="mt-2 text-slate-600">14 días de prueba con todo el sistema habilitado.</p>
        <Link to="/register" className="mt-6 inline-block">
          <Button size="md" className="px-6 py-3 text-base">
            Crear mi cuenta gratis
            <ArrowRight size={16} />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <Logo iconClassName="h-6" textSizeClass="text-sm" className="mb-2 justify-center" />
        <p>Contapro — ERP para pequeños y medianos negocios en Colombia.</p>
      </footer>
    </div>
  );
}
