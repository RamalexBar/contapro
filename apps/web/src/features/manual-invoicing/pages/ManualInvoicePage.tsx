import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateTax, formatCOP, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { MunicipalitySelect } from "../../../components/ui/MunicipalitySelect";
import { getCompanyProfile } from "../../company/api/company.api";
import { listBranches } from "../../inventory/api/branch.api";
import { createCustomer, listCustomers } from "../../customers/api/customer.api";
import { createManualInvoice, openManualInvoicePdf, type ManualInvoiceRecord } from "../api/manual-invoicing.api";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

/** Valor del selector de cliente que abre el formulario para crearlo ahi mismo. */
const NEW_CUSTOMER = "__new__";
const EMPTY_NEW_CUSTOMER = { documentType: "CC", documentNumber: "", name: "", email: "", municipalityCode: "" };

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
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [invoice, setInvoice] = useState<ManualInvoiceRecord | null>(null);
  const [newCustomer, setNewCustomer] = useState({ ...EMPTY_NEW_CUSTOMER });
  const queryClient = useQueryClient();
  const isNewCustomer = customerId === NEW_CUSTOMER;
  // La DIAN (via Factus) rechaza la factura a nombre de un cliente sin municipio.
  const selectedCustomer = customers?.data.find((c) => c.id === customerId);
  const customerMissingMunicipality = Boolean(selectedCustomer && !selectedCustomer.municipalityCode);

  // Con una sola sucursal no hay nada que elegir.
  useEffect(() => {
    if (!branchId && branches?.data.length === 1) setBranchId(branches.data[0]!.id);
  }, [branches, branchId]);

  const subtotal = round2(lines.reduce((sum, l) => sum + round2(l.unitPrice * l.quantity), 0));
  const taxTotal = round2(lines.reduce((sum, l) => sum + calculateTax(round2(l.unitPrice * l.quantity), l.taxPercent), 0));
  const total = round2(subtotal + taxTotal);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Cliente nuevo: se crea primero y la factura sale a su nombre.
      let buyerId = customerId || undefined;
      if (isNewCustomer) {
        const created = await createCustomer({
          documentType: newCustomer.documentType,
          documentNumber: newCustomer.documentNumber.replace(/[.\s]/g, ""),
          name: newCustomer.name.trim(),
          email: newCustomer.email.trim() || undefined,
          municipalityCode: newCustomer.municipalityCode,
        });
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        buyerId = created.id;
      }
      return createManualInvoice({
        branchId,
        customerId: buyerId,
        dueDate: buyerId && dueDate ? dueDate : undefined,
        items: lines
          .filter((l) => l.description.trim())
          .map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxPercent: l.taxPercent })),
      });
    },
    onSuccess: (result) => {
      setInvoice(result);
      setLines([{ ...EMPTY_LINE }]);
      setCustomerId("");
      setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
    },
  });

  const pdfMutation = useMutation({ mutationFn: openManualInvoicePdf });

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
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Factura electrónica</h1>
        <Alert tone="warning">
          Completa los <Link to="/company/profile" className="underline">datos fiscales de la empresa</Link> antes de
          crear tu primera factura electrónica.
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Factura electrónica</h1>
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
            <option value={NEW_CUSTOMER}>+ Nuevo cliente</option>
            {customers?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {isNewCustomer && (
            <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-2 sm:grid-cols-2">
              <Select label="Tipo de documento" value={newCustomer.documentType} onChange={(e) => setNewCustomer({ ...newCustomer, documentType: e.target.value })}>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="NIT">NIT</option>
                <option value="CE">Cédula de extranjería</option>
              </Select>
              <Input label="Número de documento" value={newCustomer.documentNumber} onChange={(e) => setNewCustomer({ ...newCustomer, documentNumber: e.target.value })} required />
              <Input label="Nombre o razón social" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} required />
              <Input label="Correo (opcional, le llega la factura)" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
              <div className="sm:col-span-2">
                <MunicipalitySelect
                  required
                  value={newCustomer.municipalityCode}
                  hint="La DIAN lo exige para facturar a nombre de un cliente."
                  onChange={(m) => setNewCustomer({ ...newCustomer, municipalityCode: m?.code ?? "" })}
                />
              </div>
            </div>
          )}
          {customerMissingMunicipality && (
            <Alert tone="warning" className="sm:col-span-2">
              Este cliente no tiene municipio y la DIAN rechaza la factura sin él. Complételo en{" "}
              <Link to="/customers" className="underline">Clientes</Link> o use «+ Nuevo cliente».
            </Alert>
          )}
          {customerId && (
            <Input label="Vence (opcional, 30 días si se deja vacío)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          )}
        </div>
        <p className="text-xs text-slate-500">
          La factura se contabiliza (ingreso e IVA). Con cliente queda en Cuentas por cobrar hasta que se abone; sin cliente
          (consumidor final) se registra de contado.
        </p>

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_90px_120px_90px_110px_auto] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <Input
                  label="Descripción"
                  placeholder="ej. Asesoría contable"
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                />
              </div>
              <Input
                label="Cantidad"
                type="number"
                min={0.01}
                step="any"
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
              />
              <Input
                label="Valor unitario"
                type="number"
                min={0}
                step="any"
                value={line.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
              />
              <Input
                label="IVA %"
                type="number"
                min={0}
                max={100}
                step="any"
                value={line.taxPercent}
                onChange={(e) => updateLine(i, { taxPercent: Number(e.target.value) })}
              />
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Total línea</span>
                <span className="flex h-[38px] items-center text-sm text-slate-600">{formatCOP(lineTotal(line))}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="danger"
                className="col-span-2 sm:col-span-1"
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
              >
                Quitar línea
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
          disabled={
            !branchId ||
            lines.every((l) => !l.description.trim()) ||
            customerMissingMunicipality ||
            (isNewCustomer && (!newCustomer.documentNumber.trim() || !newCustomer.name.trim() || !newCustomer.municipalityCode))
          }
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
            <Button
              variant="secondary"
              className="mt-2"
              loading={pdfMutation.isPending}
              onClick={() => pdfMutation.mutate(invoice.id)}
            >
              Ver PDF
            </Button>
            {pdfMutation.isError && (
              <Alert tone="danger" className="mt-2">
                {(pdfMutation.error as Error).message}
              </Alert>
            )}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
