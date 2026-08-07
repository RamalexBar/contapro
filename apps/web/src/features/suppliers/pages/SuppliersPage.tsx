import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateTax, formatCOP, formatCurrency, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listWithholdingConcepts } from "../../accounting/api/accounting.api";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  listAccountsPayable,
  listPurchases,
  listSuppliers,
  registerSupplierPayment,
  type PurchaseWithholdingInput,
  type SupplierRecord,
} from "../api/supplier.api";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SuppliersSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const [form, setForm] = useState({
    name: "",
    nit: "",
    contactName: "",
    phone: "",
    isObligatedToInvoice: true,
    documentType: "NIT",
    municipalityCode: "",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createSupplier({ ...form, municipalityCode: form.municipalityCode || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setForm({ name: "", nit: "", contactName: "", phone: "", isObligatedToInvoice: true, documentType: "NIT", municipalityCode: "" });
    },
  });

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo proveedor</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.documentType}
            onChange={(e) => setForm({ ...form, documentType: e.target.value })}
          >
            <option value="NIT">NIT</option>
            <option value="CC">CC</option>
            <option value="CE">CE</option>
          </select>
          <Input placeholder="NIT / documento" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required />
          <Input placeholder="Contacto" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <Input placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            placeholder="Codigo DANE municipio (opcional)"
            value={form.municipalityCode}
            onChange={(e) => setForm({ ...form, municipalityCode: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isObligatedToInvoice}
              onChange={(e) => setForm({ ...form, isObligatedToInvoice: e.target.checked })}
            />
            Obligado a facturar electronicamente
          </label>
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Nombre</th>
              <th>NIT</th>
              <th>Contacto</th>
              <th>Obligado a facturar</th>
              <th>Municipio (DANE)</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{s.name}</td>
                <td>{s.nit}</td>
                <td>{s.contactName ?? "-"}</td>
                <td>{s.isObligatedToInvoice ? "Si" : "No"}</td>
                <td className={s.municipalityCode ? "" : "text-yellow-600"}>{s.municipalityCode ?? "Sin asignar"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function PurchasesSection({ suppliers }: { suppliers: SupplierRecord[] }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data, isLoading } = useQuery({ queryKey: ["purchases"], queryFn: listPurchases });
  // Quien registra compras normalmente ya tiene accounting.read (CONTADOR/ADMINISTRADOR) -- a
  // diferencia del POS, no hay un caso de uso tipo CAJERO sin acceso aqui, pero se gatea igual
  // por consistencia con el resto de la app.
  const canApplyWithholdings = hasPermission("accounting.read");
  const { data: withholdingConcepts } = useQuery({
    queryKey: ["withholding-concepts"],
    queryFn: listWithholdingConcepts,
    enabled: canApplyWithholdings,
  });
  const activeConcepts = withholdingConcepts?.data.filter((c) => c.isActive) ?? [];

  const [form, setForm] = useState({
    supplierId: "",
    invoiceNumber: "",
    subtotal: "",
    taxTotal: "",
    dueDate: todayStr(),
    // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- ver POSPage.tsx, mismo criterio.
    currency: "COP",
    exchangeRate: "",
  });
  const [withholdings, setWithholdings] = useState<PurchaseWithholdingInput[]>([]);
  const total = (Number(form.subtotal) || 0) + (Number(form.taxTotal) || 0);
  const retentionTotal = round2(
    withholdings.reduce((sum, w) => {
      const concept = activeConcepts.find((c) => c.id === w.withholdingConceptId);
      return sum + (concept ? calculateTax(w.base, concept.ratePercent) : 0);
    }, 0)
  );
  const netTotal = round2(total - retentionTotal);

  const createMutation = useMutation({
    mutationFn: () =>
      createPurchase({
        branchId: user!.branchId!,
        supplierId: form.supplierId,
        invoiceNumber: form.invoiceNumber,
        subtotal: Number(form.subtotal),
        taxTotal: Number(form.taxTotal) || 0,
        total,
        dueDate: form.dueDate,
        withholdings,
        ...(form.currency !== "COP" ? { currency: form.currency, exchangeRate: Number(form.exchangeRate) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      setForm({ supplierId: "", invoiceNumber: "", subtotal: "", taxTotal: "", dueDate: todayStr(), currency: "COP", exchangeRate: "" });
      setWithholdings([]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPurchase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchases"] }),
  });

  function supplierName(id: string): string {
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar compra</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.supplierId}
            onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            required
          >
            <option value="">Proveedor...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Numero factura"
            value={form.invoiceNumber}
            onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
            required
          />
          <Input
            type="number"
            placeholder="Subtotal"
            value={form.subtotal}
            onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
            required
          />
          <Input type="number" placeholder="IVA" value={form.taxTotal} onChange={(e) => setForm({ ...form, taxTotal: e.target.value })} />
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            <option value="COP">COP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          {form.currency !== "COP" && (
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="TRM (COP por 1 unidad)"
              value={form.exchangeRate}
              onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
              required
            />
          )}
          <Button
            type="submit"
            disabled={createMutation.isPending || (form.currency !== "COP" && !(Number(form.exchangeRate) > 0))}
          >
            {retentionTotal > 0 ? `Neto a pagar: ${formatCOP(netTotal)}` : `Total: ${formatCOP(total)}`}
          </Button>
        </form>
        {form.currency !== "COP" && Number(form.exchangeRate) > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Referencia en {form.currency}: {formatCurrency(round2(total / Number(form.exchangeRate)), form.currency)}
          </p>
        )}

        {canApplyWithholdings && Number(form.subtotal) > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Retenciones al proveedor</h3>
              {activeConcepts.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:underline"
                  onClick={() => {
                    const first = activeConcepts[0];
                    if (!first) return;
                    setWithholdings((prev) => [...prev, { withholdingConceptId: first.id, base: Number(form.subtotal) }]);
                  }}
                >
                  + agregar retencion
                </button>
              )}
            </div>
            {withholdings.map((w, i) => (
              <div key={i} className="mb-2 flex items-center gap-2 text-sm">
                <select
                  className="flex-1 rounded border border-gray-200 px-2 py-1"
                  value={w.withholdingConceptId}
                  onChange={(e) =>
                    setWithholdings((prev) =>
                      prev.map((row, idx) => (idx === i ? { ...row, withholdingConceptId: e.target.value } : row))
                    )
                  }
                >
                  {activeConcepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.ratePercent}%)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={Number(form.subtotal)}
                  value={w.base}
                  title="Base de retencion"
                  className="w-28 rounded border border-gray-200 px-2 py-1"
                  onChange={(e) =>
                    setWithholdings((prev) => prev.map((row, idx) => (idx === i ? { ...row, base: Number(e.target.value) } : row)))
                  }
                />
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => setWithholdings((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Quitar
                </button>
              </div>
            ))}
            {retentionTotal > 0 && (
              <p className="text-sm text-gray-600">
                Retencion total: <span className="text-red-600">-{formatCOP(retentionTotal)}</span> · Neto a pagar al proveedor:{" "}
                <span className="font-semibold">{formatCOP(netTotal)}</span>
              </p>
            )}
          </div>
        )}
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Factura</th>
              <th>Proveedor</th>
              <th>Total</th>
              <th>Neto (retencion)</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">{p.invoiceNumber}</td>
                <td>{supplierName(p.supplierId)}</td>
                <td>
                  {formatCOP(p.total)}
                  {p.currency !== "COP" && p.foreignTotal !== null && (
                    <span className="block text-xs text-gray-400">{formatCurrency(p.foreignTotal, p.currency)}</span>
                  )}
                </td>
                <td>{p.retentionTotal > 0 ? formatCOP(p.total - p.retentionTotal) : "-"}</td>
                <td>{p.status}</td>
                <td className="text-right">
                  {p.status === "REGISTERED" && (
                    <Button variant="danger" onClick={() => cancelMutation.mutate(p.id)} disabled={cancelMutation.isPending}>
                      Cancelar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AccountsPayableSection({ suppliers }: { suppliers: SupplierRecord[] }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["accounts-payable"], queryFn: () => listAccountsPayable() });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH" });

  const payMutation = useMutation({
    mutationFn: (id: string) => registerSupplierPayment(id, { amount: Number(payForm.amount), method: payForm.method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      setPayingId(null);
      setPayForm({ amount: "", method: "CASH" });
    },
  });

  function supplierName(id: string): string {
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <Card>
      {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Proveedor</th>
            <th>Saldo</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((ap) => (
            <tr key={ap.id} className="border-b border-gray-100">
              <td className="py-2">{supplierName(ap.supplierId)}</td>
              <td>{formatCOP(ap.balance)}</td>
              <td>{ap.dueDate.slice(0, 10)}</td>
              <td>{ap.status}</td>
              <td className="text-right">
                {ap.status !== "PAID" && ap.status !== "CANCELLED" && payingId !== ap.id && (
                  <Button variant="secondary" onClick={() => setPayingId(ap.id)}>
                    Abonar
                  </Button>
                )}
                {payingId === ap.id && (
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="number"
                      className="w-24 rounded border border-gray-200 px-2 py-1"
                      placeholder="Monto"
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    />
                    <select
                      className="rounded border border-gray-200 px-2 py-1"
                      value={payForm.method}
                      onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                    </select>
                    <Button onClick={() => payMutation.mutate(ap.id)} disabled={!payForm.amount || payMutation.isPending}>
                      Confirmar
                    </Button>
                    <Button variant="secondary" onClick={() => setPayingId(null)}>
                      Cancelar
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type Section = "suppliers" | "purchases" | "payable";

export function SuppliersPage() {
  const [section, setSection] = useState<Section>("suppliers");
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Proveedores / Compras</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "suppliers" ? "primary" : "secondary"} onClick={() => setSection("suppliers")}>
          Proveedores
        </Button>
        <Button variant={section === "purchases" ? "primary" : "secondary"} onClick={() => setSection("purchases")}>
          Compras
        </Button>
        <Button variant={section === "payable" ? "primary" : "secondary"} onClick={() => setSection("payable")}>
          Cuentas por pagar
        </Button>
      </div>

      {section === "suppliers" && <SuppliersSection />}
      {section === "purchases" && <PurchasesSection suppliers={suppliers?.data ?? []} />}
      {section === "payable" && <AccountsPayableSection suppliers={suppliers?.data ?? []} />}
    </AppLayout>
  );
}
