import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateTax, formatCOP, formatCurrency, round2 } from "@erp/shared-utils";
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
import { listWithholdingConcepts } from "../../accounting/api/accounting.api";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  extractPurchaseInvoice,
  listAccountsPayable,
  listPurchases,
  listSuppliers,
  registerSupplierPayment,
  type ExtractPurchaseInvoiceResult,
  type PurchaseWithholdingInput,
  type SupplierRecord,
} from "../api/supplier.api";

const ACCEPTED_INVOICE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader.readAsDataURL da "data:<mime>;base64,<datos>" -- la API solo quiere <datos>.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

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
    mutationFn: () => createSupplier({ ...form, municipalityCode: form.municipalityCode || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setForm({ name: "", nit: "", contactName: "", phone: "", isObligatedToInvoice: true, documentType: "NIT", municipalityCode: "" });
    },
  });

  return (
    <div className="space-y-6">
      <Card title="Nuevo proveedor">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
            <option value="NIT">NIT</option>
            <option value="CC">CC</option>
            <option value="CE">CE</option>
          </Select>
          <Input placeholder="NIT / documento" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required />
          <Input placeholder="Contacto" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <Input placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            placeholder="Codigo DANE municipio (opcional)"
            value={form.municipalityCode}
            onChange={(e) => setForm({ ...form, municipalityCode: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isObligatedToInvoice}
              onChange={(e) => setForm({ ...form, isObligatedToInvoice: e.target.checked })}
            />
            Obligado a facturar electronicamente
          </label>
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
                <Th>Nombre</Th>
                <Th>NIT</Th>
                <Th>Contacto</Th>
                <Th>Obligado a facturar</Th>
                <Th>Municipio (DANE)</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((s) => (
                <TableRow key={s.id}>
                  <Td className="font-medium text-slate-900">{s.name}</Td>
                  <Td>{s.nit}</Td>
                  <Td>{s.contactName ?? "-"}</Td>
                  <Td>{s.isObligatedToInvoice ? "Si" : "No"}</Td>
                  <Td>
                    {s.municipalityCode ?? <Badge tone="warning">Sin asignar</Badge>}
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
  const [extractResult, setExtractResult] = useState<ExtractPurchaseInvoiceResult | null>(null);
  const [fileTypeError, setFileTypeError] = useState(false);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileBase64 = await fileToBase64(file);
      return extractPurchaseInvoice(fileBase64, file.type);
    },
    onSuccess: (result) => {
      setExtractResult(result);
      const { extracted, matchedSupplier, suggestedDueDate } = result;
      setForm((prev) => ({
        ...prev,
        supplierId: matchedSupplier?.id ?? prev.supplierId,
        invoiceNumber: extracted.invoiceNumber ?? prev.invoiceNumber,
        subtotal: extracted.subtotal != null ? String(extracted.subtotal) : prev.subtotal,
        taxTotal: extracted.taxTotal != null ? String(extracted.taxTotal) : prev.taxTotal,
        dueDate: suggestedDueDate ?? prev.dueDate,
        currency: extracted.currency || prev.currency,
      }));
    },
  });

  function handleInvoiceFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si se corrige algo y se reintenta
    if (!file) return;
    if (!ACCEPTED_INVOICE_TYPES.includes(file.type)) {
      setFileTypeError(true);
      return;
    }
    setFileTypeError(false);
    setExtractResult(null);
    extractMutation.mutate(file);
  }

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
      setExtractResult(null);
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
    <div className="space-y-6">
      <Card title="Leer factura automaticamente">
        <p className="mb-3 text-sm text-slate-500">
          Sube una foto o el PDF de la factura del proveedor y el formulario de abajo se precarga solo. Siempre revisa los datos antes
          de registrar la compra.
        </p>
        <input
          ref={invoiceFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleInvoiceFileSelected}
        />
        <Button type="button" loading={extractMutation.isPending} onClick={() => invoiceFileInputRef.current?.click()}>
          Leer factura (foto/PDF)
        </Button>

        {fileTypeError && (
          <Alert tone="danger" className="mt-3">
            Ese tipo de archivo no se puede leer. Sube una foto (JPG/PNG/WEBP) o un PDF.
          </Alert>
        )}
        {extractMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(extractMutation.error as Error).message}
          </Alert>
        )}
        {extractResult && (
          <div className="mt-3 space-y-2">
            {extractResult.matchedSupplier ? (
              <Alert tone="success">Proveedor identificado: {extractResult.matchedSupplier.name}. Revisa el resto de los datos abajo.</Alert>
            ) : (
              <Alert tone="warning">No se pudo identificar el proveedor automaticamente -- eligelo a mano abajo.</Alert>
            )}
            {extractResult.extracted.warnings.map((w, i) => (
              <Alert key={i} tone="warning">
                {w}
              </Alert>
            ))}
          </div>
        )}
      </Card>

      <Card title="Registrar compra">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
            <option value="">Proveedor...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
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
          <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option value="COP">COP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
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
            disabled={form.currency !== "COP" && !(Number(form.exchangeRate) > 0)}
            loading={createMutation.isPending}
          >
            {retentionTotal > 0 ? `Neto a pagar: ${formatCOP(netTotal)}` : `Total: ${formatCOP(total)}`}
          </Button>
        </form>
        {form.currency !== "COP" && Number(form.exchangeRate) > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            Referencia en {form.currency}: {formatCurrency(round2(total / Number(form.exchangeRate)), form.currency)}
          </p>
        )}

        {canApplyWithholdings && Number(form.subtotal) > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Retenciones al proveedor</h3>
              {activeConcepts.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-brand-600 hover:underline"
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
                <Select
                  className="flex-1"
                  value={w.withholdingConceptId}
                  onChange={(e) =>
                    setWithholdings((prev) => prev.map((row, idx) => (idx === i ? { ...row, withholdingConceptId: e.target.value } : row)))
                  }
                >
                  {activeConcepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.ratePercent}%)
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={Number(form.subtotal)}
                  value={w.base}
                  title="Base de retencion"
                  className="w-28"
                  onChange={(e) => setWithholdings((prev) => prev.map((row, idx) => (idx === i ? { ...row, base: Number(e.target.value) } : row)))}
                />
                <button
                  type="button"
                  className="text-xs text-danger-500 hover:underline"
                  onClick={() => setWithholdings((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Quitar
                </button>
              </div>
            ))}
            {retentionTotal > 0 && (
              <p className="text-sm text-slate-600">
                Retencion total: <span className="text-danger-600">-{formatCOP(retentionTotal)}</span> · Neto a pagar al proveedor:{" "}
                <span className="font-semibold text-slate-900">{formatCOP(netTotal)}</span>
              </p>
            )}
          </div>
        )}
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
                <Th>Factura</Th>
                <Th>Proveedor</Th>
                <Th>Total</Th>
                <Th>Neto (retencion)</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((p) => (
                <TableRow key={p.id}>
                  <Td className="font-medium text-slate-900">{p.invoiceNumber}</Td>
                  <Td>{supplierName(p.supplierId)}</Td>
                  <Td>
                    {formatCOP(p.total)}
                    {p.currency !== "COP" && p.foreignTotal !== null && (
                      <span className="block text-xs text-slate-400">{formatCurrency(p.foreignTotal, p.currency)}</span>
                    )}
                  </Td>
                  <Td>{p.retentionTotal > 0 ? formatCOP(p.total - p.retentionTotal) : "-"}</Td>
                  <Td>
                    <Badge tone={p.status === "CANCELLED" ? "danger" : "neutral"}>{p.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    {p.status === "REGISTERED" && (
                      <Button size="sm" variant="danger" onClick={() => cancelMutation.mutate(p.id)} loading={cancelMutation.isPending}>
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
    <Card noPadding>
      {isLoading ? (
        <Spinner />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Proveedor</Th>
              <Th>Saldo</Th>
              <Th>Vencimiento</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </TableHead>
          <TableBody>
            {data?.data.map((ap) => (
              <TableRow key={ap.id}>
                <Td className="font-medium text-slate-900">{supplierName(ap.supplierId)}</Td>
                <Td>{formatCOP(ap.balance)}</Td>
                <Td>{ap.dueDate.slice(0, 10)}</Td>
                <Td>
                  <Badge tone={ap.status === "PAID" ? "success" : ap.status === "CANCELLED" ? "danger" : "neutral"}>{ap.status}</Badge>
                </Td>
                <Td className="text-right">
                  {ap.status !== "PAID" && ap.status !== "CANCELLED" && payingId !== ap.id && (
                    <Button size="sm" variant="secondary" onClick={() => setPayingId(ap.id)}>
                      Abonar
                    </Button>
                  )}
                  {payingId === ap.id && (
                    <span className="inline-flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24"
                        placeholder="Monto"
                        value={payForm.amount}
                        onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      />
                      <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="TRANSFER">Transferencia</option>
                      </Select>
                      <Button size="sm" disabled={!payForm.amount} loading={payMutation.isPending} onClick={() => payMutation.mutate(ap.id)}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setPayingId(null)}>
                        Cancelar
                      </Button>
                    </span>
                  )}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

type Section = "suppliers" | "purchases" | "payable";

export function SuppliersPage() {
  const [section, setSection] = useState<Section>("suppliers");
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Proveedores / Compras</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Button size="sm" variant={section === "suppliers" ? "primary" : "secondary"} onClick={() => setSection("suppliers")}>
          Proveedores
        </Button>
        <Button size="sm" variant={section === "purchases" ? "primary" : "secondary"} onClick={() => setSection("purchases")}>
          Compras
        </Button>
        <Button size="sm" variant={section === "payable" ? "primary" : "secondary"} onClick={() => setSection("payable")}>
          Cuentas por pagar
        </Button>
      </div>

      {section === "suppliers" && <SuppliersSection />}
      {section === "purchases" && <PurchasesSection suppliers={suppliers?.data ?? []} />}
      {section === "payable" && <AccountsPayableSection suppliers={suppliers?.data ?? []} />}
    </AppLayout>
  );
}
