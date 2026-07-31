import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  listAccountsPayable,
  listPurchases,
  listSuppliers,
  registerSupplierPayment,
  type SupplierRecord,
} from "../api/supplier.api";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SuppliersSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const [form, setForm] = useState({ name: "", nit: "", contactName: "", phone: "", isObligatedToInvoice: true });

  const createMutation = useMutation({
    mutationFn: () => createSupplier(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setForm({ name: "", nit: "", contactName: "", phone: "", isObligatedToInvoice: true });
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
          <Input placeholder="NIT" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required />
          <Input placeholder="Contacto" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <Input placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{s.name}</td>
                <td>{s.nit}</td>
                <td>{s.contactName ?? "-"}</td>
                <td>{s.isObligatedToInvoice ? "Si" : "No"}</td>
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
  const { data, isLoading } = useQuery({ queryKey: ["purchases"], queryFn: listPurchases });

  const [form, setForm] = useState({ supplierId: "", invoiceNumber: "", subtotal: "", taxTotal: "", dueDate: todayStr() });
  const total = (Number(form.subtotal) || 0) + (Number(form.taxTotal) || 0);

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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      setForm({ supplierId: "", invoiceNumber: "", subtotal: "", taxTotal: "", dueDate: todayStr() });
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
          <Button type="submit" disabled={createMutation.isPending}>
            Total: {formatCOP(total)}
          </Button>
        </form>
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
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">{p.invoiceNumber}</td>
                <td>{supplierName(p.supplierId)}</td>
                <td>{formatCOP(p.total)}</td>
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
