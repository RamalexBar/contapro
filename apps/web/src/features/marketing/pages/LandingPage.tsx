import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  ChevronDown,
  FileCheck2,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { formatCOP } from "@erp/shared-utils";
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
  { name: "Siigo", price: "Desde $145.993", note: "módulos separados" },
  { name: "World Office", price: "Desde $170.000", note: "nómina solo en el plan tope" },
];

type AccountingStandard = "PUC" | "NIIF";
type BillingCycle = "MONTHLY" | "ANNUAL";
type CertificateChoice = "NEW" | "HAVE";

// Planes reales de Contapro (packages/database/prisma/seed-base.ts) -- los 3 planes pagos
// habilitan el mismo set de funcionalidad (POS/inventario/contabilidad/nomina/facturacion DIAN =
// true en los 4, incluido TRIAL). Lo unico que escala con el precio es maxBranches/maxUsers, no
// que modulos estan prendidos -- ver docs/PRECIOS.md, seccion "El hallazgo clave". Por eso estos
// 3 planes NO llevan una lista de features distinta cada uno: comparten la misma lista completa,
// y solo difieren en sucursales/usuarios.
const PLANS: {
  code: "BASICO" | "PYME" | "PRO";
  name: string;
  priceMonthly: number;
  priceYearly: number;
  branches: string;
  users: string;
  highlight: boolean;
}[] = [
  { code: "BASICO", name: "Plan Emprendedor", priceMonthly: 69900, priceYearly: 754920, branches: "1 sucursal", users: "3 usuarios", highlight: false },
  { code: "PYME", name: "Plan Pyme", priceMonthly: 149900, priceYearly: 1618920, branches: "3 sucursales", users: "10 usuarios", highlight: true },
  { code: "PRO", name: "Plan Plus", priceMonthly: 279900, priceYearly: 3022920, branches: "10 sucursales", users: "50 usuarios", highlight: false },
];

// Descuento anual bajado de 14-15% a un 10% parejo (2026-09-24) a cambio de incluir el
// certificado digital de firma electronica ($130.000, ver CERTIFICATE_PRICE abajo) gratis en el
// pago anual -- en valor total para el cliente (descuento + certificado) queda igual o mejor que
// antes en los 3 planes, y a nosotros nos sale mas barato en Pyme/Plus (pagamos $130.000 reales
// del certificado en vez de resignar $269.900/$503.900 en ingresos). Ver docs/PRECIOS.md si se
// revisita esta cuenta.

const SHARED_FEATURES = [
  "Facturación electrónica DIAN (factura, notas crédito/débito, documento soporte)",
  "Contabilidad completa (PUC o NIIF, según tu elección)",
  "POS e inventario con costeo real (FIFO/kardex)",
  "Nómina electrónica Colombia",
  "Reportes fiscales (exógena, retenciones)",
  "Conciliación bancaria",
];

const CERTIFICATE_PRICE = 130000;

function annualSavingsPercent(priceMonthly: number, priceYearly: number): number {
  const fullYear = priceMonthly * 12;
  return Math.round(((fullYear - priceYearly) / fullYear) * 100);
}

function AccountingStandardSelector({
  value,
  onChange,
}: {
  value: AccountingStandard | null;
  onChange: (v: AccountingStandard) => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 1 de 2</p>
      <h2 className="mt-1 text-center text-2xl font-bold text-slate-900">¿Bajo qué normativa contable trabaja tu empresa?</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
        Esto define la plantilla del plan de cuentas con la que arranca tu empresa en Contapro.
        Podés cambiarla después desde Configuración de la cuenta.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(
          [
            { id: "PUC" as const, title: "PUC", subtitle: "Plan Único de Cuentas", desc: "Normativa contable tradicional colombiana. La elección de la mayoría de las pymes." },
            { id: "NIIF" as const, title: "NIIF", subtitle: "Normas Internacionales de Información Financiera", desc: "Estándar internacional. Para empresas que reportan bajo IFRS o que la Ley 1314 clasifica como grandes/medianas." },
          ]
        ).map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={selected}
              className={`rounded-2xl border-2 p-6 text-left transition-colors ${
                selected ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-slate-900">{opt.title}</span>
                {selected && <Check size={20} className="text-brand-600" />}
              </div>
              <p className="mt-0.5 text-sm font-medium text-slate-600">{opt.subtitle}</p>
              <p className="mt-2 text-sm text-slate-500">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          ¿No sabés cuál usar? Más información
          <ChevronDown size={14} className={`transition-transform ${showHelp ? "rotate-180" : ""}`} />
        </button>
        {showHelp && (
          <p className="mx-auto mt-2 max-w-xl rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            La mayoría de pymes en Colombia usan <strong>PUC</strong>. Si tu empresa reporta bajo
            estándares internacionales o es una empresa grande/mediana según la clasificación de la
            Ley 1314, probablemente necesitás <strong>NIIF</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [accountingStandard, setAccountingStandard] = useState<AccountingStandard | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [certificateChoice, setCertificateChoice] = useState<CertificateChoice | null>(null);

  function handleSelectPlan(planCode: string) {
    if (!accountingStandard) return; // boton ya queda disabled, doble resguardo
    const params = new URLSearchParams({
      plan: planCode,
      cycle: billingCycle.toLowerCase(),
      normativa: accountingStandard.toLowerCase(),
      ...(certificateChoice ? { certificado: certificateChoice.toLowerCase() } : {}),
    });
    navigate(`/register?${params.toString()}`);
  }

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
            Siigo y World Office venden facturación, contabilidad, POS y nómina como
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
              <p className="mt-1 text-xl font-bold text-slate-900">Desde $69.900</p>
              <p className="mt-1 text-xs text-brand-700">todo incluido · COP/mes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Normativa contable (paso previo a los planes) */}
      <section id="precios" className="border-t border-slate-100 px-4 py-16">
        <AccountingStandardSelector value={accountingStandard} onChange={setAccountingStandard} />
      </section>

      {/* Planes */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">Planes simples, todo el sistema incluido</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">
            La diferencia entre planes es cuánto creces (sucursales y usuarios), no qué módulos
            podés usar. Todos incluyen POS, inventario, contabilidad, nómina y facturación DIAN.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${billingCycle === "MONTHLY" ? "text-slate-900" : "text-slate-400"}`}>Mensual</span>
            <button
              type="button"
              role="switch"
              aria-checked={billingCycle === "ANNUAL"}
              onClick={() => setBillingCycle((c) => (c === "MONTHLY" ? "ANNUAL" : "MONTHLY"))}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand-600 transition-colors"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  billingCycle === "ANNUAL" ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === "ANNUAL" ? "text-slate-900" : "text-slate-400"}`}>
              Anual <span className="text-success-600">(ahorra 10% + certificado digital gratis)</span>
            </span>
          </div>

          <div className="relative mt-10">
            {!accountingStandard && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                  Elegí PUC o NIIF arriba para ver el detalle completo de los planes
                </p>
              </div>
            )}

            <div className={`grid grid-cols-1 gap-6 sm:grid-cols-3 ${!accountingStandard ? "pointer-events-none select-none opacity-40" : ""}`}>
              {PLANS.map((plan) => {
                const price = billingCycle === "MONTHLY" ? plan.priceMonthly : plan.priceYearly;
                const period = billingCycle === "MONTHLY" ? "/mes" : "/año";
                const savings = annualSavingsPercent(plan.priceMonthly, plan.priceYearly);

                return (
                  <div
                    key={plan.code}
                    className={`flex flex-col rounded-xl border bg-white p-6 ${
                      plan.highlight ? "border-2 border-brand-600 shadow-md" : "border-slate-200"
                    }`}
                  >
                    {plan.highlight && (
                      <span className="mb-2 inline-block w-fit rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                        Más popular
                      </span>
                    )}
                    <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                    <p className="mt-2">
                      <span className="text-2xl font-bold text-slate-900">{formatCOP(price)}</span>{" "}
                      <span className="text-sm text-slate-500">{period}</span>
                    </p>
                    {billingCycle === "ANNUAL" && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs font-medium text-success-600">Ahorrás {savings}% vs. pagar mes a mes</p>
                        <p className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                          <ShieldCheck size={13} /> + Certificado digital ({formatCOP(CERTIFICATE_PRICE)}) incluido gratis
                        </p>
                      </div>
                    )}

                    <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                      <li className="flex items-center gap-2 font-medium text-slate-900">
                        <Check size={15} className="text-success-600" /> {plan.branches}
                      </li>
                      <li className="flex items-center gap-2 font-medium text-slate-900">
                        <Check size={15} className="text-success-600" /> {plan.users}
                      </li>
                      {SHARED_FEATURES.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check size={15} className="mt-0.5 shrink-0 text-success-600" /> {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={plan.highlight ? "primary" : "secondary"}
                      className="mt-6 w-full"
                      disabled={!accountingStandard}
                      onClick={() => handleSelectPlan(plan.code)}
                    >
                      Elegir {plan.name}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Certificado digital -- deliberadamente separado de la tabla de planes, con un estilo
          distinto (fondo gris, icono de escudo) para que se note que es un cargo aparte, cobrado
          por una entidad certificadora externa (ej. Certicamara, GSE), no por Contapro. Pagando
          anual (2026-09-24) va incluido gratis -- ver el comentario junto a PLANS.priceYearly. */}
      <section className="px-4 py-10">
        <div className={`mx-auto max-w-4xl rounded-xl border p-6 sm:p-8 ${
          billingCycle === "ANNUAL" ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-100"
        }`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              billingCycle === "ANNUAL" ? "bg-brand-100" : "bg-slate-200"
            }`}>
              <ShieldCheck size={22} className={billingCycle === "ANNUAL" ? "text-brand-700" : "text-slate-600"} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Certificado digital de firma electrónica</h3>
              <p className="mt-1 text-sm text-slate-600">
                Todos los planes requieren un certificado digital de firma electrónica, exigido por
                la DIAN para poder emitir facturación electrónica.
              </p>
              {billingCycle === "ANNUAL" ? (
                <p className="mt-2 text-sm">
                  <span className="text-slate-400 line-through">{formatCOP(CERTIFICATE_PRICE)}</span>{" "}
                  <span className="text-lg font-bold text-brand-700">Incluido gratis</span>{" "}
                  <span className="text-slate-500">con tu pago anual</span>
                </p>
              ) : (
                <p className="mt-2 text-sm">
                  <span className="text-lg font-bold text-slate-900">{formatCOP(CERTIFICATE_PRICE)}</span>{" "}
                  <span className="text-slate-500">/año, facturación anual única</span>
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {billingCycle === "ANNUAL"
                  ? "Pagando mes a mes, este valor se cobra por separado."
                  : "Este valor se cobra por separado y no está incluido en la suscripción mensual. Cambiá a pago anual para que quede incluido."}
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setCertificateChoice("NEW")}
                  aria-pressed={certificateChoice === "NEW"}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    certificateChoice === "NEW" ? "border-brand-600 bg-white ring-1 ring-brand-600" : "border-slate-300 bg-white"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <FileCheck2 size={15} /> Necesito certificado digital nuevo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCertificateChoice("HAVE")}
                  aria-pressed={certificateChoice === "HAVE"}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    certificateChoice === "HAVE" ? "border-brand-600 bg-white ring-1 ring-brand-600" : "border-slate-300 bg-white"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <Check size={15} /> Ya tengo uno vigente
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integraciones -- placeholder de CTA hacia documentacion de API, sin pagina real todavia. */}
      <section className="border-t border-slate-100 px-4 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 text-center sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50">
            <Plug size={22} className="text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Conectá Contapro con tus sistemas</h3>
          <p className="max-w-xl text-sm text-slate-600">
            Contapro se integra vía API con sistemas externos para generar facturación electrónica
            automáticamente — por ejemplo, un POS de restaurante que ya usás como producto
            independiente puede conectarse a Contapro para facturar cada venta sin doble digitación.
          </p>
          <p className="text-sm font-medium text-slate-700">¿Tenés un POS o sistema propio? Conectalo con Contapro</p>
          <a href="#">
            <Button variant="secondary">Ver documentación de la API</Button>
          </a>
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
        <Logo heightClassName="h-6" className="mb-2" />
        <p>Contapro — ERP para pequeños y medianos negocios en Colombia.</p>
      </footer>
    </div>
  );
}
