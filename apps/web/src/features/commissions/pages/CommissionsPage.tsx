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
        <Card title="Nuevo esquema de comision" className="mb-6">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Select value={form.sellerUserId} onChange={(e) => setForm({ ...form, sellerUserId: e.target.value })} required>
              <option value="">Vendedor...</option>
              {sellers?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step="0.01"
              placeholder="Tarifa %"
              value={form.ratePercent}
              onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
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
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay esquemas todavia." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Vendedor</Th>
                <Th>Tarifa</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((s) => (
                <TableRow key={s.id}>
                  <Td>{sellerName(s.sellerUserId)}</Td>
                  <Td>{s.ratePercent}%</Td>
                  <Td>
                    <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Activo" : "Inactivo"}</Badge>
                  </Td>
                  <Td className="text-right">
                    {canManage && s.isActive && (
                      <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(s.id)}>
                        Desactivar
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
          <Input label="Año" type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <Input label="Mes" type="number" min={1} max={12} className="w-16" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          {canManage && (
            <Button loading={calculateMutation.isPending} onClick={() => calculateMutation.mutate()}>
              Calcular comisiones del periodo
            </Button>
          )}
        </div>
        {calculateMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(calculateMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="Sin liquidaciones para este periodo." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Vendedor</Th>
                <Th>Base (ventas)</Th>
                <Th>Tarifa</Th>
                <Th>Comision</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((s) => (
                <TableRow key={s.id}>
                  <Td>{sellerName(s.sellerUserId)}</Td>
                  <Td>{formatCOP(s.salesBase)}</Td>
                  <Td>{s.ratePercent}%</Td>
                  <Td className="font-medium">{formatCOP(s.commissionAmount)}</Td>
                  <Td>
                    <Badge tone={s.status === "PAID" ? "success" : "warning"}>{s.status === "PAID" ? "Pagada" : "Calculada"}</Badge>
                  </Td>
                  <Td className="text-right">
                    {canManage && s.status === "CALCULATED" && payingId !== s.id && (
                      <Button size="sm" variant="secondary" onClick={() => setPayingId(s.id)}>
                        Pagar
                      </Button>
                    )}
                    {payingId === s.id && (
                      <span className="inline-flex items-center gap-2">
                        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                          <option value="CASH">Efectivo</option>
                          <option value="CARD">Tarjeta</option>
                          <option value="TRANSFER">Transferencia</option>
                        </Select>
                        <Button size="sm" loading={payMutation.isPending} onClick={() => payMutation.mutate(s.id)}>
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
    </>
  );
}

type Section = "schemes" | "settlements";

export function CommissionsPage() {
  const [section, setSection] = useState<Section>("settlements");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Comisiones de vendedores</h1>
      <div className="mb-6 flex gap-2">
        <Button size="sm" variant={section === "settlements" ? "primary" : "secondary"} onClick={() => setSection("settlements")}>
          Liquidaciones
        </Button>
        <Button size="sm" variant={section === "schemes" ? "primary" : "secondary"} onClick={() => setSection("schemes")}>
          Esquemas
        </Button>
      </div>

      {section === "schemes" && <SchemesSection />}
      {section === "settlements" && <SettlementsSection />}
    </AppLayout>
  );
}
