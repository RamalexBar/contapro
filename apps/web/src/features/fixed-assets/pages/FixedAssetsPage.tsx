import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
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
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo activo fijo</h2>
          <p className="mb-3 text-sm text-gray-500">
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
              <th className="py-2">Nombre</th>
              <th>Compra</th>
              <th>Costo</th>
              <th>Depreciacion acum.</th>
              <th>Valor en libros</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2">{a.name}</td>
                <td>{a.purchaseDate.slice(0, 10)}</td>
                <td>{formatCOP(a.cost)}</td>
                <td>{formatCOP(a.accumulatedDepreciation)}</td>
                <td className="font-medium">{formatCOP(a.cost - a.accumulatedDepreciation)}</td>
                <td className={a.isActive ? "text-green-600" : "text-gray-400"}>{a.isActive ? "Activo" : "Dado de baja"}</td>
                <td className="text-right">
                  {canManage && a.isActive && (
                    <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(a.id)}>
                      Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay activos fijos todavia.</p>}
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
              {calculateMutation.isPending ? "Calculando..." : "Calcular depreciacion del periodo"}
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
              <th className="py-2">Activo</th>
              <th>Cuota</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((e) => (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="py-2">{assetName(e.fixedAssetId)}</td>
                <td className="font-medium">{formatCOP(e.amount)}</td>
                <td className={e.status === "POSTED" ? "text-green-600" : "text-yellow-600"}>
                  {e.status === "POSTED" ? "Contabilizada" : "Calculada"}
                </td>
                <td className="text-right">
                  {canManage && e.status === "CALCULATED" && (
                    <Button variant="secondary" disabled={postMutation.isPending} onClick={() => postMutation.mutate(e.id)}>
                      Contabilizar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">Sin entradas de depreciacion para este periodo.</p>}
      </Card>
    </>
  );
}

type Section = "assets" | "depreciation";

export function FixedAssetsPage() {
  const [section, setSection] = useState<Section>("assets");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Activos fijos</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "assets" ? "primary" : "secondary"} onClick={() => setSection("assets")}>
          Activos
        </Button>
        <Button variant={section === "depreciation" ? "primary" : "secondary"} onClick={() => setSection("depreciation")}>
          Depreciacion
        </Button>
      </div>

      {section === "assets" && <AssetsSection />}
      {section === "depreciation" && <DepreciationSection />}
    </AppLayout>
  );
}
