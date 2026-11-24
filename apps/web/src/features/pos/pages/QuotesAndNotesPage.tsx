import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listProducts } from "../../inventory/api/product.api";
import { listCustomers } from "../../customers/api/customer.api";
import {
  CREDIT_NOTE_CONCEPT_LABELS,
  CREDIT_NOTE_CONCEPTS,
  DEBIT_NOTE_CONCEPTS,
  createCreditNote,
  createDebitNote,
  createQuote,
  listCreditNotes,
  listDebitNotes,
  listQuotes,
  printNotePdf,
  printQuotePdf,
  resubmitNote,
  type NoteInput,
  type NoteRecord,
} from "../api/notes.api";
import { getElectronicInvoiceBySale, getSale, listSales, type ElectronicInvoiceStatus } from "../api/sale.api";

const DIAN_STATUS_LABEL: Record<ElectronicInvoiceStatus["status"], string> = {
  GENERATED: "Generada",
  PENDING_SIGNATURE: "Pendiente DIAN",
  PENDING_SUBMISSION: "Pendiente DIAN",
  ACCEPTED: "Aceptada DIAN",
  REJECTED: "Rechazada DIAN",
};

const DIAN_STATUS_TONE: Record<ElectronicInvoiceStatus["status"], "neutral" | "success" | "warning" | "danger"> = {
  GENERATED: "neutral",
  PENDING_SIGNATURE: "warning",
  PENDING_SUBMISSION: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
};

function DianStatusBadge({ invoice }: { invoice: ElectronicInvoiceStatus | null | undefined }) {
  if (!invoice) return <Badge tone="neutral">Sin factura electrónica</Badge>;
  return <Badge tone={DIAN_STATUS_TONE[invoice.status]}>{DIAN_STATUS_LABEL[invoice.status]}</Badge>;
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  EXPIRED: "Vencida",
  CONVERTED: "Convertida en venta",
};
const QUOTE_STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  EXPIRED: "danger",
  CONVERTED: "success",
};

const SALE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_AUTHORIZATION: "Pendiente de autorización",
  COMPLETED: "Completada",
  CANCELLED: "Anulada",
  RETURNED_PARTIAL: "Con devolución parcial",
  RETURNED_FULL: "Devuelta completa",
};

const RETURN_STATUS_LABEL: Record<string, string> = { PENDING: "Registrada" };
import { createReturn, listReturns, type RefundMethod } from "../api/return.api";

const RETURNABLE_SALE_STATUSES = new Set(["COMPLETED", "RETURNED_PARTIAL"]);

interface QuoteLine {
  productId: string;
  name: string;
  location: string | null;
  quantity: number;
}

function QuoteSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreate = useAuthStore((s) => s.hasPermission("quote.create"));
  const canRead = useAuthStore((s) => s.hasPermission("sale.read"));

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: canCreate });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
    enabled: canCreate,
  });
  const { data: quotes } = useQuery({ queryKey: ["quotes"], queryFn: listQuotes, enabled: canRead });

  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([]);

  function addLine(product: { id: string; name: string; location: string | null }) {
    setLines((prev) => {
      if (prev.some((l) => l.productId === product.id)) return prev;
      return [...prev, { productId: product.id, name: product.name, location: product.location, quantity: 1 }];
    });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createQuote({
        branchId: user!.branchId!,
        customerId: customerId || undefined,
        validUntil: new Date(validUntil),
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, discountPercent: 0 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setLines([]);
      setValidUntil("");
    },
  });
  const printMutation = useMutation({ mutationFn: printQuotePdf });

  return (
    <Card title="Cotizaciones" className="mb-6">
      {canCreate && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Cliente (opcional)" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Sin cliente</option>
              {customers?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Valida hasta" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {products?.data.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addLine(p)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-brand-200 hover:bg-brand-50"
              >
                + {p.name}
                {p.location && <span className="ml-1 text-slate-400">📍 {p.location}</span>}
              </button>
            ))}
          </div>

          {lines.length > 0 && (
            <div className="space-y-1">
              {lines.map((line) => (
                <div key={line.productId} className="flex items-center gap-2 text-sm">
                  <span className="flex flex-1 flex-col">
                    <span className="text-slate-800">{line.name}</span>
                    {line.location && <span className="text-xs text-slate-500">📍 {line.location}</span>}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    className="w-16"
                    onChange={(e) =>
                      setLines((prev) => prev.map((l) => (l.productId === line.productId ? { ...l, quantity: Number(e.target.value) } : l)))
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-danger-500 hover:underline"
                    onClick={() => setLines((prev) => prev.filter((l) => l.productId !== line.productId))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button disabled={lines.length === 0 || !validUntil} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Crear cotizacion
          </Button>
          {createMutation.isError && <Alert tone="danger">{(createMutation.error as Error).message}</Alert>}
        </div>
      )}

      {canRead &&
        (quotes?.data.length === 0 ? (
          <EmptyState title="Sin cotizaciones todavia" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Estado</Th>
                <Th>Subtotal</Th>
                <Th>Total</Th>
                <Th>Valida hasta</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {quotes?.data.map((q) => (
                <TableRow key={q.id}>
                  <Td>
                    <Badge tone={QUOTE_STATUS_TONE[q.status] ?? "neutral"}>{QUOTE_STATUS_LABEL[q.status] ?? q.status}</Badge>
                  </Td>
                  <Td>{formatCOP(q.subtotal)}</Td>
                  <Td>{formatCOP(q.total)}</Td>
                  <Td>{q.validUntil.slice(0, 10)}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => printMutation.mutate(q.id)}
                      loading={printMutation.isPending && printMutation.variables === q.id}
                    >
                      Imprimir
                    </Button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </Card>
  );
}

/** Estado ante la DIAN de una nota o de la nota credito de una devolucion. */
function NoteDianStatus({ electronic }: { electronic: { fullNumber: string; status: string; rejectionReason: string | null } | null | undefined }) {
  if (!electronic) return <Badge tone="neutral">Sin documento electrónico</Badge>;
  const status = electronic.status as ElectronicInvoiceStatus["status"];
  return (
    <span title={electronic.rejectionReason ?? undefined}>
      <Badge tone={DIAN_STATUS_TONE[status] ?? "neutral"}>{DIAN_STATUS_LABEL[status] ?? electronic.status}</Badge>
    </span>
  );
}

/** Ventas sobre las que se puede emitir una nota (ya facturadas, no anuladas). */
const NOTE_SALE_STATUSES = new Set(["COMPLETED", "RETURNED_PARTIAL", "RETURNED_FULL"]);

function NoteSection({
  kind,
  title,
  createPermission,
  concepts,
  conceptLabels,
  createFn,
  listFn,
  help,
}: {
  kind: "credit" | "debit";
  title: string;
  createPermission: string;
  concepts: Record<string, string>;
  conceptLabels: Record<string, string>;
  createFn: (input: NoteInput) => Promise<NoteRecord>;
  listFn: () => Promise<{ data: NoteRecord[] }>;
  help: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = `${kind}-notes`;
  const canCreate = useAuthStore((s) => s.hasPermission(createPermission));
  const canRead = useAuthStore((s) => s.hasPermission("sale.read"));

  const { data: sales } = useQuery({ queryKey: ["sales"], queryFn: listSales, enabled: canCreate || canRead });
  const { data: notes } = useQuery({ queryKey: [queryKey], queryFn: listFn, enabled: canRead });

  const [saleId, setSaleId] = useState("");
  const [conceptCode, setConceptCode] = useState(Object.keys(concepts)[0]!);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  const noteSales = (sales?.data ?? []).filter((s) => NOTE_SALE_STATUSES.has(s.status));
  const saleNumber = (id: string | null) => sales?.data.find((s) => s.id === id)?.number;

  const createMutation = useMutation({
    mutationFn: () => createFn({ saleId, conceptCode, reason, amount: Number(amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setReason("");
      setAmount("");
    },
  });
  const resubmitMutation = useMutation({
    mutationFn: (noteId: string) => resubmitNote(kind, noteId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
  });

  return (
    <Card title={title} className="mb-6">
      {canCreate && (
        <form
          className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <p className="col-span-full text-sm text-slate-500">{help}</p>
          <Select label="Venta facturada" value={saleId} onChange={(e) => setSaleId(e.target.value)} required>
            <option value="">Seleccionar venta...</option>
            {noteSales.map((s) => (
              <option key={s.id} value={s.id}>
                Venta #{s.number} - {formatCOP(s.total)}
              </option>
            ))}
          </Select>
          <Select label="Concepto DIAN" value={conceptCode} onChange={(e) => setConceptCode(e.target.value)} required>
            {Object.entries(concepts).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
          <Input label="Valor total (con IVA)" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <div className="flex items-end">
            <Button type="submit" loading={createMutation.isPending} disabled={!saleId}>
              Emitir
            </Button>
          </div>
          {createMutation.isError && (
            <Alert tone="danger" className="col-span-full">
              {(createMutation.error as Error).message}
            </Alert>
          )}
          {createMutation.data && (
            <Alert tone={createMutation.data.electronic?.status === "ACCEPTED" ? "success" : "warning"} className="col-span-full">
              {createMutation.data.electronic?.status === "ACCEPTED"
                ? `Nota emitida y aceptada por la DIAN: ${createMutation.data.electronic.fullNumber}`
                : "La nota quedó registrada pero el documento electrónico no se aceptó. Revise el estado abajo o en Auditoría y reenvíela."}
            </Alert>
          )}
        </form>
      )}
      {resubmitMutation.isError && (
        <Alert tone="danger" className="mb-3">
          {(resubmitMutation.error as Error).message}
        </Alert>
      )}
      {canRead &&
        (notes?.data.length === 0 ? (
          <EmptyState title="Sin registros todavia" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Fecha</Th>
                <Th>Número</Th>
                <Th>Venta</Th>
                <Th>Concepto</Th>
                <Th>Motivo</Th>
                <Th>Valor</Th>
                <Th>DIAN</Th>
                <Th />
              </tr>
            </TableHead>
            <TableBody>
              {notes?.data.map((n) => (
                <TableRow key={n.id}>
                  <Td>{n.createdAt.slice(0, 10)}</Td>
                  <Td>{n.electronic?.status === "ACCEPTED" ? n.electronic.fullNumber : "—"}</Td>
                  <Td>{saleNumber(n.saleId) ? `#${saleNumber(n.saleId)}` : "—"}</Td>
                  <Td>{conceptLabels[n.conceptCode] ?? n.conceptCode}</Td>
                  <Td>{n.reason}</Td>
                  <Td>{formatCOP(n.amount)}</Td>
                  <Td>
                    <NoteDianStatus electronic={n.electronic} />
                  </Td>
                  <Td>
                    {n.electronic?.status === "ACCEPTED" ? (
                      <Button size="sm" variant="secondary" onClick={() => printNotePdf(kind, n.id)}>
                        PDF
                      </Button>
                    ) : n.electronic && canCreate ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={resubmitMutation.isPending && resubmitMutation.variables === n.id}
                        onClick={() => resubmitMutation.mutate(n.id)}
                      >
                        Reenviar
                      </Button>
                    ) : null}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </Card>
  );
}

function ReturnSection() {
  const queryClient = useQueryClient();
  const canCreate = useAuthStore((s) => s.hasPermission("return.create"));
  const canRead = useAuthStore((s) => s.hasPermission("sale.read"));

  const { data: sales } = useQuery({ queryKey: ["sales"], queryFn: listSales, enabled: canCreate });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: canCreate });
  const { data: allReturns } = useQuery({ queryKey: ["returns"], queryFn: () => listReturns(), enabled: canRead });

  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});

  const { data: sale } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: canCreate && Boolean(saleId),
  });
  const { data: saleReturns } = useQuery({
    queryKey: ["returns", saleId],
    queryFn: () => listReturns(saleId),
    enabled: canCreate && Boolean(saleId),
  });
  const { data: electronicInvoice } = useQuery({
    queryKey: ["electronic-invoice", saleId],
    queryFn: () => getElectronicInvoiceBySale(saleId),
    enabled: canCreate && Boolean(saleId),
  });

  const returnableSales = (sales?.data ?? []).filter((s) => RETURNABLE_SALE_STATUSES.has(s.status));
  const productName = (id: string) => products?.data.find((p) => p.id === id)?.name ?? id;

  const alreadyReturnedByItem = new Map<string, number>();
  for (const ret of saleReturns?.data ?? []) {
    for (const item of ret.items) {
      alreadyReturnedByItem.set(item.saleItemId, (alreadyReturnedByItem.get(item.saleItemId) ?? 0) + item.quantity);
    }
  }

  function selectSale(id: string) {
    setSaleId(id);
    setQuantities({});
    setRestock({});
  }

  const hasItemsToReturn = Object.values(quantities).some((qty) => qty > 0);

  const createMutation = useMutation({
    mutationFn: () =>
      createReturn({
        saleId,
        reason,
        refundMethod,
        items: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([saleItemId, qty]) => ({ saleItemId, quantity: qty, restockedToBranch: restock[saleItemId] ?? true })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["returns", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setReason("");
      setQuantities({});
      setRestock({});
    },
  });

  return (
    <Card title="Devoluciones" className="mb-6">
      {canCreate && (
        <div className="mb-4 space-y-3">
          <Select label="Venta" className="sm:w-auto" value={saleId} onChange={(e) => selectSale(e.target.value)}>
            <option value="">Seleccionar venta...</option>
            {returnableSales.map((s) => (
              <option key={s.id} value={s.id}>
                Venta #{s.number} - {formatCOP(s.total)} - {SALE_STATUS_LABEL[s.status] ?? s.status}
              </option>
            ))}
          </Select>

          {sale && (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Venta #{sale.number}</span>
                <DianStatusBadge invoice={electronicInvoice} />
              </div>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Producto</Th>
                    <Th>Vendido</Th>
                    <Th>Ya devuelto</Th>
                    <Th>Cantidad a devolver</Th>
                    <Th>Reponer a inventario</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {sale.items.map((item) => {
                    const alreadyReturned = alreadyReturnedByItem.get(item.id) ?? 0;
                    const remaining = item.quantity - alreadyReturned;
                    return (
                      <TableRow key={item.id}>
                        <Td>{productName(item.productId)}</Td>
                        <Td>{item.quantity}</Td>
                        <Td>{alreadyReturned}</Td>
                        <Td>
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            disabled={remaining <= 0}
                            value={quantities[item.id] ?? 0}
                            className="w-20"
                            onChange={(e) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [item.id]: Math.max(0, Math.min(Number(e.target.value), remaining)),
                              }))
                            }
                          />
                        </Td>
                        <Td>
                          <input
                            type="checkbox"
                            checked={restock[item.id] ?? true}
                            disabled={remaining <= 0}
                            onChange={(e) => setRestock((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                          />
                        </Td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-end gap-3">
                <Input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required />
                <Select label="Medio de reembolso" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CREDIT_TO_ACCOUNT">Abono a cuenta del cliente</option>
                </Select>
                <Button disabled={!hasItemsToReturn || !reason} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
                  Registrar devolucion
                </Button>
              </div>
              {createMutation.isError && <Alert tone="danger">{(createMutation.error as Error).message}</Alert>}
            </>
          )}
        </div>
      )}

      {canRead &&
        (allReturns?.data.length === 0 ? (
          <EmptyState title="Sin devoluciones todavia" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Motivo</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th>Nota crédito DIAN</Th>
                <Th>Fecha</Th>
              </tr>
            </TableHead>
            <TableBody>
              {allReturns?.data.map((r) => (
                <TableRow key={r.id}>
                  <Td>{r.reason}</Td>
                  <Td>{formatCOP(r.total)}</Td>
                  <Td>
                    <Badge tone="success">{RETURN_STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </Td>
                  <Td>
                    {r.creditNote?.status === "ACCEPTED" ? <span className="mr-2 text-xs text-slate-500">{r.creditNote.fullNumber}</span> : null}
                    <NoteDianStatus electronic={r.creditNote} />
                  </Td>
                  <Td>{r.createdAt.slice(0, 10)}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </Card>
  );
}

export function QuotesAndNotesPage() {
  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Cotizaciones, notas y devoluciones</h1>
      <QuoteSection />
      <NoteSection
        kind="credit"
        title="Notas crédito"
        createPermission="creditnote.create"
        concepts={CREDIT_NOTE_CONCEPTS}
        conceptLabels={CREDIT_NOTE_CONCEPT_LABELS}
        createFn={createCreditNote}
        listFn={listCreditNotes}
        help="Para un descuento o ajuste de precio sobre una venta ya facturada. Si el cliente devuelve productos, use Devoluciones: genera la nota crédito y además reintegra inventario y dinero."
      />
      <NoteSection
        kind="debit"
        title="Notas débito"
        createPermission="debitnote.create"
        concepts={DEBIT_NOTE_CONCEPTS}
        conceptLabels={DEBIT_NOTE_CONCEPTS}
        createFn={createDebitNote}
        listFn={listDebitNotes}
        help="Para cobrar un valor adicional sobre una venta ya facturada (intereses, gastos de cobranza, cambio de precio). Solo el cambio del valor lleva IVA."
      />
      <ReturnSection />
    </AppLayout>
  );
}
