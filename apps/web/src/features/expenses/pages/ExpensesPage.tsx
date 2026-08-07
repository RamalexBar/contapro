import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listCostCenters } from "../../accounting/api/accounting.api";
import {
  cancelExpense,
  createExpense,
  createExpenseCategory,
  deactivateExpenseCategory,
  listExpenseCategories,
  listExpenses,
  updateExpenseCategory,
} from "../api/expense.api";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CategoriesSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["expense-categories"], queryFn: listExpenseCategories });
  const [form, setForm] = useState({ code: "", name: "", accountCode: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", accountCode: "" });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createExpenseCategory(form),
    onSuccess: () => {
      invalidate();
      setForm({ code: "", name: "", accountCode: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateExpenseCategory(id, editForm),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateExpenseCategory,
    onSuccess: () => invalidate(),
  });

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva categoria de gasto</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input
            placeholder="Cuenta PUC (ej. 5120)"
            value={form.accountCode}
            onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
            required
          />
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
              <th className="py-2">Codigo</th>
              <th>Nombre</th>
              <th>Cuenta</th>
              <th>Activa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{c.code}</td>
                  <td>
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="w-24 rounded border border-gray-200 px-2 py-1"
                      value={editForm.accountCode}
                      onChange={(e) => setEditForm({ ...editForm, accountCode: e.target.value })}
                    />
                  </td>
                  <td>{c.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(c.id)}>
                      Guardar
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.accountCode}</td>
                  <td>{c.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditForm({ name: c.name, accountCode: c.accountCode });
                      }}
                    >
                      Editar
                    </Button>
                    {c.isActive && (
                      <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(c.id)}>
                        Desactivar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function ExpensesSection({ categories }: { categories: { id: string; name: string; code: string; isActive: boolean }[] }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });
  const { data: costCenters } = useQuery({ queryKey: ["cost-centers"], queryFn: listCostCenters });

  const [form, setForm] = useState({
    expenseCategoryId: "",
    payeeName: "",
    description: "",
    date: todayStr(),
    subtotal: "",
    taxTotal: "",
    paymentMethod: "CASH" as "CASH" | "CARD" | "TRANSFER",
    costCenterId: "",
  });
  const total = (Number(form.subtotal) || 0) + (Number(form.taxTotal) || 0);

  const createMutation = useMutation({
    mutationFn: () =>
      createExpense({
        branchId: user!.branchId!,
        expenseCategoryId: form.expenseCategoryId,
        payeeName: form.payeeName,
        description: form.description || undefined,
        date: form.date,
        subtotal: Number(form.subtotal),
        taxTotal: Number(form.taxTotal) || 0,
        total,
        paymentMethod: form.paymentMethod,
        costCenterId: form.costCenterId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setForm({
        expenseCategoryId: "",
        payeeName: "",
        description: "",
        date: todayStr(),
        subtotal: "",
        taxTotal: "",
        paymentMethod: "CASH",
        costCenterId: "",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  function categoryName(id: string): string {
    return categories.find((c) => c.id === id)?.name ?? id;
  }

  function costCenterName(id: string | null): string {
    if (!id) return "-";
    return costCenters?.data.find((c) => c.id === id)?.name ?? id;
  }

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar gasto</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.expenseCategoryId}
            onChange={(e) => setForm({ ...form, expenseCategoryId: e.target.value })}
            required
          >
            <option value="">Categoria...</option>
            {categories
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <Input
            placeholder="Pagado a (arrendador, empresa...)"
            value={form.payeeName}
            onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
            required
          />
          <Input placeholder="Descripcion (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <Input
            type="number"
            placeholder="Subtotal"
            value={form.subtotal}
            onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
            required
          />
          <Input type="number" placeholder="IVA" value={form.taxTotal} onChange={(e) => setForm({ ...form, taxTotal: e.target.value })} />
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as "CASH" | "CARD" | "TRANSFER" })}
          >
            <option value="CASH">Efectivo</option>
            <option value="CARD">Tarjeta</option>
            <option value="TRANSFER">Transferencia</option>
          </select>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.costCenterId}
            onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}
          >
            <option value="">Sin centro de costo</option>
            {costCenters?.data.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={createMutation.isPending}>
            Registrar: {formatCOP(total)}
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Fecha</th>
              <th>Categoria</th>
              <th>Pagado a</th>
              <th>Total</th>
              <th>Metodo</th>
              <th>Centro de costo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((e) => (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="py-2">{e.date.slice(0, 10)}</td>
                <td>{categoryName(e.expenseCategoryId)}</td>
                <td>{e.payeeName}</td>
                <td>{formatCOP(e.total)}</td>
                <td>{e.paymentMethod}</td>
                <td>{costCenterName(e.costCenterId)}</td>
                <td>{e.status}</td>
                <td className="text-right">
                  {e.status === "REGISTERED" && (
                    <Button variant="danger" onClick={() => cancelMutation.mutate(e.id)} disabled={cancelMutation.isPending}>
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

type Section = "categories" | "expenses";

export function ExpensesPage() {
  const [section, setSection] = useState<Section>("expenses");
  const { data: categories } = useQuery({ queryKey: ["expense-categories"], queryFn: listExpenseCategories });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Gastos operativos</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "expenses" ? "primary" : "secondary"} onClick={() => setSection("expenses")}>
          Gastos
        </Button>
        <Button variant={section === "categories" ? "primary" : "secondary"} onClick={() => setSection("categories")}>
          Categorias
        </Button>
      </div>

      {section === "expenses" && <ExpensesSection categories={categories?.data ?? []} />}
      {section === "categories" && <CategoriesSection />}
    </AppLayout>
  );
}
