import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "./Table";
import { Badge } from "./Badge";
import { Alert } from "./Alert";
import { Spinner } from "./Spinner";
import { EmptyState } from "./EmptyState";

export interface PaymentHistoryItem {
  id: string;
  paidAt: string;
  amount: number;
  method: string;
  status: string;
  partyName: string;
  partyDocument: string;
  documentLabel: string;
}

const METHOD_LABELS: Record<string, string> = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", WOMPI: "Wompi" };
const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "danger" }> = {
  REGISTERED: { label: "Registrado", tone: "success" },
  REVERSED: { label: "Reversado", tone: "neutral" },
  FAILED: { label: "Fallido", tone: "danger" },
};

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Historial de recibos (cobros a clientes o pagos a proveedores) con filtro por fechas, para reimprimir
 * cualquiera y no solo el del ultimo pago registrado.
 */
export function PaymentHistoryCard({
  title,
  queryKey,
  partyLabel,
  fetchPayments,
  printPayment,
}: {
  title: string;
  queryKey: string;
  partyLabel: string;
  fetchPayments: (range: { from: string; to: string }) => Promise<PaymentHistoryItem[]>;
  printPayment: (id: string) => Promise<void>;
}) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [printing, setPrinting] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({ queryKey: [queryKey, from, to], queryFn: () => fetchPayments({ from, to }) });

  async function print(id: string) {
    setPrintError(null);
    setPrinting(id);
    try {
      await printPayment(id);
    } catch (err) {
      setPrintError((err as Error).message);
    } finally {
      setPrinting(null);
    }
  }

  const total = (data ?? []).filter((p) => p.status === "REGISTERED").reduce((s, p) => s + p.amount, 0);

  return (
    <Card className="mt-6" noPadding>
      <div className="flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {data && data.length > 0 && <p className="text-xs text-slate-500">{data.length} recibos · total registrado {formatCOP(total)}</p>}
        </div>
        <div className="flex items-end gap-2">
          <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {printError && (
        <div className="px-4 pb-3">
          <Alert tone="danger">{printError}</Alert>
        </div>
      )}
      {isLoading && <Spinner />}
      {isError && (
        <div className="px-4 pb-4">
          <Alert tone="danger">{(error as Error).message}</Alert>
        </div>
      )}
      {data && data.length === 0 && <EmptyState title="No hay recibos en esas fechas" />}
      {data && data.length > 0 && (
        <Table>
          <TableHead>
            <tr>
              <Th>Fecha</Th>
              <Th>{partyLabel}</Th>
              <Th>Abono a</Th>
              <Th>Medio</Th>
              <Th>Valor</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </TableHead>
          <TableBody>
            {data.map((p) => {
              const status = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
              return (
                <TableRow key={p.id}>
                  <Td>{p.paidAt.slice(0, 10)}</Td>
                  <Td>
                    {p.partyName}
                    {p.partyDocument && <span className="block text-xs text-slate-500">{p.partyDocument}</span>}
                  </Td>
                  <Td>{p.documentLabel}</Td>
                  <Td>{METHOD_LABELS[p.method] ?? p.method}</Td>
                  <Td>{formatCOP(p.amount)}</Td>
                  <Td>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Td>
                  <Td>
                    <Button size="sm" variant="secondary" loading={printing === p.id} onClick={() => print(p.id)}>
                      Reimprimir
                    </Button>
                  </Td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
