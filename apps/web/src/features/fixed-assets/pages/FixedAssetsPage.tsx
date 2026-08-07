import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import {
  calculateDepreciation,
  createFixedAsset,
  deactivateFixedAsset,
  listDepreciationEntries,
  listFixedAssets,
  postDepreciationEntry,
} from "../api/fixed-assets.api";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = { name: "", description: "", purchaseDate: todayStr(), cost: "", salvageValue: "", usefulLifeMonths: "" };

function AssetsSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission("fixed-asset.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["fixed-assets"], queryFn: listFixedAssets });
  const [form, setForm] = useState(EMPTY_FORM);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createFixedAsset({
        branchId: user!.branchId!,
        name: form.name,
        description: form.description || undefined,
        purchaseDate: form.purchaseDate,
        cost: Number(form.cost),
        salvageValue: form.salvageValue ? Number(form.salvageValue) : undefined,
        usefulLifeMonths: Number(form.usefulLifeMonths),
      }),
    onSuccess: () => {
      invalidate();
      setForm(EMPTY_FORM);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateFixedAsset,
    onSuccess: () => invalidate(),
  });

  return (
    <>
      {canManage && (
        <Card title="Nuevo activo fijo" className="mb-6">
          <p className="mb-3 text-sm text-slate-500">
            Este registro no contabiliza la compra (eso ya se hizo por Proveedores o Gastos) -- solo
            lleva la depreciación hacia adelante desde el costo y la fecha indicados.
          </p>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input
              placeholder="Descripcion (opcional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              required
            />
            <Input
              type="number"
              placeholder="Costo"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              required
            />
            <Input
              type="number"
              placeholder="Valor residual (opcional)"
              value={form.salvageValue}
              onChange={(e) => setForm({ ...form, salvageValue: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Vida util (meses)"
              value={form.usefulLifeMonths}
              onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })}
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
          <EmptyState title="No hay activos fijos todavia." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nombre</Th>
                <Th>Compra</Th>
                <Th>Costo</Th>
                <Th>Depreciacion acum.</Th>
                <Th>Valor en libros</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((a) => (
                <TableRow key={a.id}>
                  <Td>{a.name}</Td>
                  <Td>{a.purchaseDate.slice(0, 10)}</Td>
                  <Td>{formatCOP(a.cost)}</Td>
                  <Td>{formatCOP(a.accumulatedDepreciation)}</Td>
                  <Td className="font-medium">{formatCOP(a.cost - a.accumulatedDepreciation)}</Td>
                  <Td>
                    <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "Activo" : "Dado de baja"}</Badge>
                  </Td>
                  <Td className="text-right">
                    {canManage && a.isActive && (
                      <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(a.id)}>
                        Dar de baja
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

function DepreciationSection() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("fixed-asset.manage"));
  const { data: assets } = useQuery({ queryKey: ["fixed-assets"], queryFn: listFixedAssets });
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["depreciation-entries", year, month],
    queryFn: () => listDepreciationEntries({ year, month }),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["depreciation-entries"] });
  }

  const calculateMutation = useMutation({
    mutationFn: () => calculateDepreciation(year, month),
    onSuccess: () => invalidate(),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => postDepreciationEntry(id),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
    },
  });

  function assetName(id: string): string {
    return assets?.data.find((a) => a.id === id)?.name ?? id;
  }

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input label="Año" type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <Input label="Mes" type="number" min={1} max={12} className="w-16" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          {canManage && (
            <Button loading={calculateMutation.isPending} onClick={() => calculateMutation.mutate()}>
              Calcular depreciacion del periodo
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
          <EmptyState title="Sin entradas de depreciacion para este periodo." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Activo</Th>
                <Th>Cuota</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((e) => (
                <TableRow key={e.id}>
                  <Td>{assetName(e.fixedAssetId)}</Td>
                  <Td className="font-medium">{formatCOP(e.amount)}</Td>
                  <Td>
                    <Badge tone={e.status === "POSTED" ? "success" : "warning"}>{e.status === "POSTED" ? "Contabilizada" : "Calculada"}</Badge>
                  </Td>
                  <Td className="text-right">
                    {canManage && e.status === "CALCULATED" && (
                      <Button size="sm" variant="secondary" loading={postMutation.isPending} onClick={() => postMutation.mutate(e.id)}>
                        Contabilizar
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

type Section = "assets" | "depreciation";

export function FixedAssetsPage() {
  const [section, setSection] = useState<Section>("assets");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Activos fijos</h1>
      <div className="mb-6 flex gap-2">
        <Button size="sm" variant={section === "assets" ? "primary" : "secondary"} onClick={() => setSection("assets")}>
          Activos
        </Button>
        <Button size="sm" variant={section === "depreciation" ? "primary" : "secondary"} onClick={() => setSection("depreciation")}>
          Depreciacion
        </Button>
      </div>

      {section === "assets" && <AssetsSection />}
      {section === "depreciation" && <DepreciationSection />}
    </AppLayout>
  );
}
