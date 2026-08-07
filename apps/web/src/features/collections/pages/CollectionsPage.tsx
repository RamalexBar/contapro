import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { listCustomers } from "../../customers/api/customer.api";
import { createReceivableCheckout, listAccountsReceivable, registerReceivablePayment } from "../api/collections.api";

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
      <h1 className="mb-4 text-lg font-semibold">Cuentas por cobrar</h1>
      <p className="mb-4 text-sm text-gray-500">
        Ventas a credito (metodo de pago CREDIT en el punto de venta). Se pueden cobrar en persona
        (abono) o generando un link de pago en linea (Wompi) para que el cliente pague directo.
      </p>

      {checkoutResult && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-800">
            Link de pago generado:{" "}
            <a href={checkoutResult.url} target="_blank" rel="noreferrer" className="underline">
              {checkoutResult.url}
            </a>
          </p>
          <button className="mt-1 text-xs text-blue-600 hover:underline" onClick={() => setCheckoutResult(null)}>
            Cerrar
          </button>
        </Card>
      )}
      {checkoutError && <p className="mb-4 text-sm text-red-600">{checkoutError}</p>}

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Cliente</th>
              <th>Saldo</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((ar) => (
              <tr key={ar.id} className="border-b border-gray-100">
                <td className="py-2">{customerName(ar.customerId)}</td>
                <td>{formatCOP(ar.balance)}</td>
                <td>{ar.dueDate.slice(0, 10)}</td>
                <td>{ar.status}</td>
                <td className="text-right">
                  {ar.status !== "PAID" && ar.status !== "CANCELLED" && payingId !== ar.id && (
                    <span className="inline-flex items-center gap-2">
                      <Button variant="secondary" onClick={() => setPayingId(ar.id)}>
                        Abonar
                      </Button>
                      <Button variant="secondary" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate(ar.id)}>
                        Generar link de pago
                      </Button>
                    </span>
                  )}
                  {payingId === ar.id && (
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
                      <Button onClick={() => payMutation.mutate(ar.id)} disabled={!payForm.amount || payMutation.isPending}>
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
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay cuentas por cobrar todavia.</p>}
      </Card>
    </AppLayout>
  );
}
