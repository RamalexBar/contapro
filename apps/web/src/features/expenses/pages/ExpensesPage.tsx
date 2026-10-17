import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateTax, formatCOP, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listCostCenters } from "../../accounting/api/accounting.api";
import {
  cancelExpense,
  createExpense,
  createExpenseCategory,
  deactivateExpenseCategory,
  extractExpenseReceipt,
  listExpenseCategories,
  listExpenses,
  printExpensePdf,
  updateExpenseCategory,
} from "../api/expense.api";
import type { ExtractExpenseReceiptResult } from "../api/expense.api";

const ACCEPTED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // readAsDataURL da "data:<mime>;base64,<datos>" -- la API solo quiere <datos>.
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

const EXPENSE_STATUS_LABEL: Record<string, string> = { REGISTERED: "Registrado", CANCELLED: "Anulado" };

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
    <div className="space-y-6">
      <Card title="Nueva categoria de gasto">
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
          <Button type="submit" loading={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Codigo</Th>
                <Th>Nombre</Th>
                <Th>Cuenta</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) =>
                editingId === c.id ? (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-slate-900">{c.code}</Td>
                    <Td>
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </Td>
                    <Td>
                      <Input className="w-24" value={editForm.accountCode} onChange={(e) => setEditForm({ ...editForm, accountCode: e.target.value })} />
                    </Td>
                    <Td>
                      <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Activa" : "Inactiva"}</Badge>
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(c.id)}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </Td>
                  </TableRow>
                ) : (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-slate-900">{c.code}</Td>
                    <Td>{c.name}</Td>
                    <Td>{c.accountCode}</Td>
                    <Td>
                      <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Activa" : "Inactiva"}</Badge>
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditForm({ name: c.name, accountCode: c.accountCode });
                        }}
                      >
                        Editar
                      </Button>
                      {c.isActive && (
                        <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(c.id)}>
                          Desactivar
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
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
    taxPercent: "",
    paymentMethod: "CASH" as "CASH" | "CARD" | "TRANSFER",
    costCenterId: "",
  });
  const subtotal = Number(form.subtotal) || 0;
  const taxTotal = round2(calculateTax(subtotal, Number(form.taxPercent) || 0));
  const total = round2(subtotal + taxTotal);

  // Lectura del soporte (foto/PDF): llena el formulario para revisar, no registra nada.
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptResult, setReceiptResult] = useState<ExtractExpenseReceiptResult | null>(null);
  const [receiptTypeError, setReceiptTypeError] = useState(false);
  const extractMutation = useMutation({
    mutationFn: async (file: File) => extractExpenseReceipt(await fileToBase64(file), file.type),
    onSuccess: (result) => {
      setReceiptResult(result);
      const { extracted, suggestedCategory, taxRatePercent } = result;
      const details = [
        extracted.description,
        extracted.documentNumber ? `Doc. ${extracted.documentNumber}` : null,
        extracted.payeeNit ? `NIT ${extracted.payeeNit}` : null,
      ].filter(Boolean);
      setForm((prev) => ({
        ...prev,
        expenseCategoryId: suggestedCategory?.id ?? prev.expenseCategoryId,
        payeeName: extracted.payeeName ?? prev.payeeName,
        description: details.length > 0 ? details.join(" · ") : prev.description,
        date: extracted.issueDate && /^d{4}-d{2}-d{2}$/.test(extracted.issueDate) ? extracted.issueDate : prev.date,
        subtotal: extracted.subtotal != null ? String(extracted.subtotal) : prev.subtotal,
        taxPercent: taxRatePercent != null ? String(taxRatePercent) : prev.taxPercent,
      }));
    },
  });
  function handleReceiptSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
      setReceiptTypeError(true);
      return;
    }
    setReceiptTypeError(false);
    setReceiptResult(null);
    extractMutation.mutate(file);
  }
  const receiptTotal = receiptResult?.extracted.total ?? null;
  const totalMismatch = receiptTotal != null && Math.abs(receiptTotal - total) > 1;

  const createMutation = useMutation({
    mutationFn: () =>
      createExpense({
        branchId: user!.branchId!,
        expenseCategoryId: form.expenseCategoryId,
        payeeName: form.payeeName,
        description: form.description || undefined,
        date: form.date,
        subtotal,
        taxTotal,
        total,
        paymentMethod: form.paymentMethod,
        costCenterId: form.costCenterId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setReceiptResult(null);
      setForm({
        expenseCategoryId: "",
        payeeName: "",
        description: "",
        date: todayStr(),
        subtotal: "",
        taxPercent: "",
        paymentMethod: "CASH",
        costCenterId: "",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
  const printMutation = useMutation({ mutationFn: printExpensePdf });

  function categoryName(id: string): string {
    return categories.find((c) => c.id === id)?.name ?? id;
  }

  function costCenterName(id: string | null): string {
    if (!id) return "-";
    return costCenters?.data.find((c) => c.id === id)?.name ?? id;
  }

  return (
    <div className="space-y-6">
      <Card title="Leer soporte automáticamente">
        <p className="mb-3 text-sm text-slate-500">
          Sube una foto o el PDF del recibo o la factura del gasto (servicios públicos, arriendo, transporte, papelería...): se
          llenan el formulario de abajo y la categoría sugerida. Siempre revisa los datos antes de registrar.
        </p>
        <input ref={receiptInputRef} type="file" accept={ACCEPTED_RECEIPT_TYPES.join(",")} className="hidden" onChange={handleReceiptSelected} />
        <Button type="button" loading={extractMutation.isPending} onClick={() => receiptInputRef.current?.click()}>
          Leer soporte (foto/PDF)
        </Button>
        {receiptTypeError && (
          <Alert tone="danger" className="mt-3">
            Ese tipo de archivo no se puede leer. Sube una foto (JPG/PNG/WEBP) o un PDF.
          </Alert>
        )}
        {extractMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(extractMutation.error as Error).message}
          </Alert>
        )}
        {receiptResult && (
          <div className="mt-3 space-y-2">
            {receiptResult.suggestedCategory ? (
              <Alert tone="success">
                Categoría sugerida: {receiptResult.suggestedCategory.name}. Revisa el resto de los datos abajo.
              </Alert>
            ) : (
              <Alert tone="warning">No se pudo sugerir una categoría -- elígela a mano abajo.</Alert>
            )}
            {receiptTotal != null && (
              <p className="text-sm text-slate-600">
                Total del soporte: <span className="font-semibold">{formatCOP(receiptTotal)}</span>
              </p>
            )}
            {totalMismatch && (
              <Alert tone="warning">
                El total del formulario ({formatCOP(total)}) no coincide con el del soporte. Revisa el subtotal y el IVA %.
              </Alert>
            )}
            {receiptResult.extracted.warnings.length > 0 && (
              <Alert tone="warning">
                <ul className="list-disc pl-4">
                  {receiptResult.extracted.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        )}
      </Card>

      <Card title="Registrar gasto">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Select value={form.expenseCategoryId} onChange={(e) => setForm({ ...form, expenseCategoryId: e.target.value })} required>
            <option value="">Categoria...</option>
            {categories
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
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
            placeholder="Subtotal (sin IVA)"
            value={form.subtotal}
            onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
            required
          />
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            placeholder="IVA % (ej. 19)"
            value={form.taxPercent}
            onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
          />
          <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as "CASH" | "CARD" | "TRANSFER" })}>
            <option value="CASH">Efectivo</option>
            <option value="CARD">Tarjeta</option>
            <option value="TRANSFER">Transferencia</option>
          </Select>
          <Select value={form.costCenterId} onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}>
            <option value="">Sin centro de costo</option>
            {costCenters?.data
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
          </Select>
          <p className="col-span-2 text-sm text-slate-500 sm:col-span-4">
            Subtotal: {formatCOP(subtotal)} · IVA: {formatCOP(taxTotal)} · <span className="font-semibold text-slate-700">Total: {formatCOP(total)}</span>
          </p>
          <Button type="submit" loading={createMutation.isPending}>
            Registrar: {formatCOP(total)}
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Fecha</Th>
                <Th>Categoria</Th>
                <Th>Pagado a</Th>
                <Th>Total</Th>
                <Th>Metodo</Th>
                <Th>Centro de costo</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((e) => (
                <TableRow key={e.id}>
                  <Td>{e.date.slice(0, 10)}</Td>
                  <Td>{categoryName(e.expenseCategoryId)}</Td>
                  <Td>{e.payeeName}</Td>
                  <Td>{formatCOP(e.total)}</Td>
                  <Td>{e.paymentMethod}</Td>
                  <Td>{costCenterName(e.costCenterId)}</Td>
                  <Td>
                    <Badge tone={e.status === "CANCELLED" ? "danger" : "neutral"}>{EXPENSE_STATUS_LABEL[e.status] ?? e.status}</Badge>
                  </Td>
                  <Td className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => printMutation.mutate(e.id)}
                      loading={printMutation.isPending && printMutation.variables === e.id}
                    >
                      Imprimir
                    </Button>
                    {e.status === "REGISTERED" && (
                      <Button size="sm" variant="danger" onClick={() => cancelMutation.mutate(e.id)} loading={cancelMutation.isPending}>
                        Cancelar
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

type Section = "categories" | "expenses";

export function ExpensesPage() {
  const [section, setSection] = useState<Section>("expenses");
  const { data: categories } = useQuery({ queryKey: ["expense-categories"], queryFn: listExpenseCategories });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Gastos operativos</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Button size="sm" variant={section === "expenses" ? "primary" : "secondary"} onClick={() => setSection("expenses")}>
          Gastos
        </Button>
        <Button size="sm" variant={section === "categories" ? "primary" : "secondary"} onClick={() => setSection("categories")}>
          Categorias
        </Button>
      </div>

      {section === "expenses" && <ExpensesSection categories={categories?.data ?? []} />}
      {section === "categories" && <CategoriesSection />}
    </AppLayout>
  );
}
