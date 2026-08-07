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
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Clientes</h1>

      {canManage && (
        <Card title="Nuevo cliente" className="mb-6">
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
            <Select value={form.priceListId} onChange={(e) => setForm({ ...form, priceListId: e.target.value })}>
              <option value="">Sin lista de precios (precio base)</option>
              {activePriceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </Select>
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
        <div className="border-b border-slate-200 p-4">
          <Input placeholder="Buscar por nombre o documento..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay clientes." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Documento</Th>
                <Th>Nombre</Th>
                <Th>Cupo de credito</Th>
                <Th>Saldo actual</Th>
                <Th>Lista de precios</Th>
                <Th>Estado</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) => (
                <TableRow key={c.id}>
                  <Td>
                    {c.documentType} {c.documentNumber}
                  </Td>
                  <Td>{c.name}</Td>
                  <Td>{formatCOP(c.creditLimit)}</Td>
                  <Td>{formatCOP(c.currentBalance)}</Td>
                  <Td>
                    {canManage ? (
                      <Select
                        className="text-xs"
                        value={c.priceListId ?? ""}
                        disabled={priceListMutation.isPending}
                        onChange={(e) => priceListMutation.mutate({ id: c.id, priceListId: e.target.value || null })}
                      >
                        <option value="">Precio base</option>
                        {activePriceLists.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      activePriceLists.find((pl) => pl.id === c.priceListId)?.name ?? "Precio base"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Activo" : "Inactivo"}</Badge>
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
