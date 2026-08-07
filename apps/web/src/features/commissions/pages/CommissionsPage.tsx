import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import {
  calculateCommissions,
  createCommissionScheme,
  deactivateCommissionScheme,
  listCommissionSchemes,
  listCommissionSettlements,
  listSellers,
  payCommissionSettlement,
} from "../api/commissions.api";

function SchemesSection() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("commission.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["commission-schemes"], queryFn: listCommissionSchemes });
  const { data: sellers } = useQuery({ queryKey: ["commission-sellers"], queryFn: listSellers });
  const [form, setForm] = useState({ sellerUserId: "", ratePercent: "" });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["commission-schemes"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createCommissionScheme({ sellerUserId: form.sellerUserId, ratePercent: Number(form.ratePercent) }),
    onSuccess: () => {
      invalidate();
      setForm({ sellerUserId: "", ratePercent: "" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateCommissionScheme,
    onSuccess: () => invalidate(),
  });

  function sellerName(id: string): string {
    return sellers?.data.find((s) => s.id === id)?.fullName ?? id;
  }

  return (
    <>
      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo esquema de comision</h2>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.sellerUserId}
              onChange={(e) => setForm({ ...form, sellerUserId: e.target.value })}
              required
            >
              <option value="">Vendedor...</option>
              {sellers?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <Input
              type="number"
              step="0.01"
              placeholder="Tarifa %"
              value={form.ratePercent}
              onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
              required
            />
            <Button type="submit" disabled={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
        </Card>
      )}

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Vendedor</th>
              <th>Tarifa</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{sellerName(s.sellerUserId)}</td>
                <td>{s.ratePercent}%</td>
                <td className={s.isActive ? "text-green-600" : "text-gray-400"}>{s.isActive ? "Activo" : "Inactivo"}</td>
                <td className="text-right">
                  {canManage && s.isActive && (
                    <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(s.id)}>
                      Desactivar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay esquemas todavia.</p>}
      </Card>
    </>
  );
}

function SettlementsSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission("commission.manage"));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const { data: sellers } = useQuery({ queryKey: ["commission-sellers"], queryFn: listSellers });
  const { data, isLoading } = useQuery({
    queryKey: ["commission-settlements", year, month],
    queryFn: () => listCommissionSettlements({ year, month }),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["commission-settlements"] });
  }

  const calculateMutation = useMutation({
    mutationFn: () => calculateCommissions(year, month),
    onSuccess: () => invalidate(),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => payCommissionSettlement(id, { branchId: user!.branchId!, paymentMethod }),
    onSuccess: () => {
      invalidate();
      setPayingId(null);
      setPaymentMethod("CASH");
    },
  });

  function sellerName(id: string): string {
    return sellers?.data.find((s) => s.id === id)?.fullName ?? id;
  }

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Año:
            <input
              type="number"
              className="w-24 rounded border border-gray-300 px-2 py-1"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Mes:
            <input
              type="number"
              min={1}
              max={12}
              className="w-16 rounded border border-gray-300 px-2 py-1"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </label>
          {canManage && (
            <Button disabled={calculateMutation.isPending} onClick={() => calculateMutation.mutate()}>
              {calculateMutation.isPending ? "Calculando..." : "Calcular comisiones del periodo"}
            </Button>
          )}
        </div>
        {calculateMutation.isError && <p className="mt-2 text-sm text-red-600">{(calculateMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Vendedor</th>
              <th>Base (ventas)</th>
              <th>Tarifa</th>
              <th>Comision</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{sellerName(s.sellerUserId)}</td>
                <td>{formatCOP(s.salesBase)}</td>
                <td>{s.ratePercent}%</td>
                <td className="font-medium">{formatCOP(s.commissionAmount)}</td>
                <td className={s.status === "PAID" ? "text-green-600" : "text-yellow-600"}>
                  {s.status === "PAID" ? "Pagada" : "Calculada"}
                </td>
                <td className="text-right">
                  {canManage && s.status === "CALCULATED" && payingId !== s.id && (
                    <Button variant="secondary" onClick={() => setPayingId(s.id)}>
                      Pagar
                    </Button>
                  )}
                  {payingId === s.id && (
                    <span className="inline-flex items-center gap-2">
                      <select
                        className="rounded border border-gray-200 px-2 py-1"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="TRANSFER">Transferencia</option>
                      </select>
                      <Button disabled={payMutation.isPending} onClick={() => payMutation.mutate(s.id)}>
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
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">Sin liquidaciones para este periodo.</p>}
      </Card>
    </>
  );
}

type Section = "schemes" | "settlements";

export function CommissionsPage() {
  const [section, setSection] = useState<Section>("settlements");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Comisiones de vendedores</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "settlements" ? "primary" : "secondary"} onClick={() => setSection("settlements")}>
          Liquidaciones
        </Button>
        <Button variant={section === "schemes" ? "primary" : "secondary"} onClick={() => setSection("schemes")}>
          Esquemas
        </Button>
      </div>

      {section === "schemes" && <SchemesSection />}
      {section === "settlements" && <SettlementsSection />}
    </AppLayout>
  );
}
