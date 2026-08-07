import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { listCustomers } from "../../customers/api/customer.api";
import { createReceivableCheckout, listAccountsReceivable, registerReceivablePayment } from "../api/collections.api";

function statusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "CANCELLED") return "neutral";
  if (status === "OVERDUE") return "danger";
  return "warning";
}

export function CollectionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["accounts-receivable"], queryFn: () => listAccountsReceivable() });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH" });
  const [checkoutResult, setCheckoutResult] = useState<{ id: string; url: string } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
  }

  const payMutation = useMutation({
    mutationFn: (id: string) => registerReceivablePayment(id, { amount: Number(payForm.amount), method: payForm.method }),
    onSuccess: () => {
      invalidate();
      setPayingId(null);
      setPayForm({ amount: "", method: "CASH" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (id: string) => createReceivableCheckout(id),
    onSuccess: (result, id) => {
      setCheckoutResult({ id, url: result.checkoutUrl });
      setCheckoutError(null);
    },
    onError: (err: Error) => setCheckoutError(err.message),
  });

  function customerName(id: string): string {
    return customers?.data.find((c) => c.id === id)?.name ?? id;
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Cuentas por cobrar</h1>
      <p className="mb-4 text-sm text-slate-500">
        Ventas a credito (metodo de pago CREDIT en el punto de venta). Se pueden cobrar en persona
        (abono) o generando un link de pago en linea (Wompi) para que el cliente pague directo.
      </p>

      {checkoutResult && (
        <Alert tone="info" className="mb-4">
          Link de pago generado:{" "}
          <a href={checkoutResult.url} target="_blank" rel="noreferrer" className="underline">
            {checkoutResult.url}
          </a>
          <button className="ml-2 text-xs underline" onClick={() => setCheckoutResult(null)}>
            Cerrar
          </button>
        </Alert>
      )}
      {checkoutError && (
        <Alert tone="danger" className="mb-4">
          {checkoutError}
        </Alert>
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay cuentas por cobrar todavia." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Cliente</Th>
                <Th>Saldo</Th>
                <Th>Vencimiento</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((ar) => (
                <TableRow key={ar.id}>
                  <Td>{customerName(ar.customerId)}</Td>
                  <Td>{formatCOP(ar.balance)}</Td>
                  <Td>{ar.dueDate.slice(0, 10)}</Td>
                  <Td>
                    <Badge tone={statusTone(ar.status)}>{ar.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    {ar.status !== "PAID" && ar.status !== "CANCELLED" && payingId !== ar.id && (
                      <span className="inline-flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setPayingId(ar.id)}>
                          Abonar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={checkoutMutation.isPending}
                          onClick={() => checkoutMutation.mutate(ar.id)}
                        >
                          Generar link de pago
                        </Button>
                      </span>
                    )}
                    {payingId === ar.id && (
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
                        <Button size="sm" disabled={!payForm.amount} loading={payMutation.isPending} onClick={() => payMutation.mutate(ar.id)}>
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
    </AppLayout>
  );
}
