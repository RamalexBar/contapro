import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createCustomer, listCustomers, updateCustomerPriceList } from "../api/customer.api";
import { listPriceLists } from "../../inventory/api/price-list.api";

const EMPTY_FORM = {
  documentType: "CC",
  documentNumber: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  creditLimit: "",
  priceListId: "",
  municipalityCode: "",
};

export function CustomerListPage() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("customer.manage"));

  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["customers", search], queryFn: () => listCustomers(search) });

  const { data: priceLists } = useQuery({ queryKey: ["price-lists"], queryFn: listPriceLists });
  const activePriceLists = priceLists?.data.filter((pl) => pl.isActive) ?? [];

  const [form, setForm] = useState(EMPTY_FORM);
  const createMutation = useMutation({
    mutationFn: () =>
      createCustomer({
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
        priceListId: form.priceListId || undefined,
        municipalityCode: form.municipalityCode || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setForm(EMPTY_FORM);
    },
  });

  const priceListMutation = useMutation({
    mutationFn: ({ id, priceListId }: { id: string; priceListId: string | null }) =>
      updateCustomerPriceList(id, priceListId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Clientes</h1>

      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo cliente</h2>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input
              placeholder="Tipo de documento"
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value })}
              required
            />
            <Input
              placeholder="Numero de documento"
              value={form.documentNumber}
              onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
              required
            />
            <Input
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input
              placeholder="Direccion"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <Input
              placeholder="Cupo de credito"
              type="number"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
            />
            <Input
              placeholder="Codigo DANE municipio (opcional)"
              value={form.municipalityCode}
              onChange={(e) => setForm({ ...form, municipalityCode: e.target.value })}
            />
            <select
              className="rounded-md border border-gray-200 px-3 py-2 text-sm"
              value={form.priceListId}
              onChange={(e) => setForm({ ...form, priceListId: e.target.value })}
            >
              <option value="">Sin lista de precios (precio base)</option>
              {activePriceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </Card>
      )}

      <Card>
        <Input
          placeholder="Buscar por nombre o documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Documento</th>
              <th>Nombre</th>
              <th>Cupo de credito</th>
              <th>Saldo actual</th>
              <th>Lista de precios</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2">
                  {c.documentType} {c.documentNumber}
                </td>
                <td>{c.name}</td>
                <td>{formatCOP(c.creditLimit)}</td>
                <td>{formatCOP(c.currentBalance)}</td>
                <td>
                  {canManage ? (
                    <select
                      className="rounded border border-gray-200 px-2 py-1 text-xs"
                      value={c.priceListId ?? ""}
                      disabled={priceListMutation.isPending}
                      onChange={(e) =>
                        priceListMutation.mutate({ id: c.id, priceListId: e.target.value || null })
                      }
                    >
                      <option value="">Precio base</option>
                      {activePriceLists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    activePriceLists.find((pl) => pl.id === c.priceListId)?.name ?? "Precio base"
                  )}
                </td>
                <td className={c.isActive ? "text-green-600" : "text-gray-400"}>
                  {c.isActive ? "Activo" : "Inactivo"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay clientes.</p>}
      </Card>
    </AppLayout>
  );
}
