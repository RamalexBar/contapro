import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { calculateTax, formatCOP, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { getCompanyProfile } from "../../company/api/company.api";
import { listBranches } from "../../inventory/api/branch.api";
import { listCustomers } from "../../customers/api/customer.api";
import { createManualInvoice, openManualInvoicePdf, type ManualInvoiceRecord } from "../api/manual-invoicing.api";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

const EMPTY_LINE: LineItem = { description: "", quantity: 1, unitPrice: 0, taxPercent: 19 };

function lineTotal(line: LineItem): number {
  const subtotal = round2(line.unitPrice * line.quantity);
  return round2(subtotal + calculateTax(subtotal, line.taxPercent));
}

export function ManualInvoicePage() {
  const { data: profile, isLoading: loadingProfile } = useQuery({ queryKey: ["company-profile"], queryFn: getCompanyProfile });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches, enabled: profile?.complete });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers(), enabled: profile?.complete });

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [invoice, setInvoice] = useState<ManualInvoiceRecord | null>(null);

  const subtotal = round2(lines.reduce((sum, l) => sum + round2(l.unitPrice * l.quantity), 0));
  const taxTotal = round2(lines.reduce((sum, l) => sum + calculateTax(round2(l.unitPrice * l.quantity), l.taxPercent), 0));
  const total = round2(subtotal + taxTotal);

  const createMutation = useMutation({
    mutationFn: () =>
      createManualInvoice({
        branchId,
        customerId: customerId || undefined,
        items: lines
          .filter((l) => l.description.trim())
          .map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxPercent: l.taxPercent })),
      }),
    onSuccess: (result) => {
      setInvoice(result);
      setLines([{ ...EMPTY_LINE }]);
      setCustomerId("");
    },
  });

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  if (loadingProfile) {
    return (
      <AppLayout>
        <Spinner />
      </AppLayout>
    );
  }

  if (!profile?.complete) {
    return (
      <AppLayout>
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Factura manual</h1>
        <Alert tone="warning">
          Completa los <Link to="/company/profile" className="underline">datos fiscales de la empresa</Link> antes de
          crear tu primera factura manual.
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Factura manual</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Crea una factura electrónica DIAN con líneas de descripción libre, sin pasar por el punto de
        venta ni el catálogo de inventario.
      </p>

      <Card title="Nueva factura" className="max-w-3xl">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">Selecciona una sucursal</option>
            {branches?.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select label="Cliente (opcional)" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Consumidor final</option>
            {customers?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[1fr_90px_120px_90px_110px_auto]">
              <Input
                placeholder="Descripción"
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
              />
              <Input
                type="number"
                min={0.01}
                step="any"
                placeholder="Cant."
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Valor unitario"
                value={line.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
              />
              <Input
                type="number"
                min={0}
                max={100}
                step="any"
                placeholder="IVA %"
                value={line.taxPercent}
                onChange={(e) => updateLine(i, { taxPercent: Number(e.target.value) })}
              />
              <span className="flex items-center text-sm text-slate-600">{formatCOP(lineTotal(line))}</span>
              <Button type="button" size="sm" variant="danger" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                Quitar
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={addLine}>
          Agregar línea
        </Button>

        <div className="mt-4 space-y-1 text-right text-sm">
          <p>Subtotal: {formatCOP(subtotal)}</p>
          <p>IVA: {formatCOP(taxTotal)}</p>
          <p className="font-semibold">Total: {formatCOP(total)}</p>
        </div>

        <Button
          className="mt-4"
          loading={createMutation.isPending}
          disabled={!branchId || lines.every((l) => !l.description.trim())}
          onClick={() => createMutation.mutate()}
        >
          Crear factura
        </Button>

        {createMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createMutation.error as Error).message}
          </Alert>
        )}

        {invoice && (
          <div className="mt-4">
            <Alert tone="success">Factura creada por {formatCOP(invoice.total)}.</Alert>
            <Button variant="secondary" className="mt-2" onClick={() => openManualInvoicePdf(invoice.id)}>
              Ver PDF
            </Button>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
