import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createCustomer, listCustomers } from "../api/customer.api";

const EMPTY_FORM = {
  documentType: "CC",
  documentNumber: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  creditLimit: "",
};

export function CustomerListPage() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("customer.manage"));

  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["customers", search], queryFn: () => listCustomers(search) });

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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setForm(EMPTY_FORM);
    },
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
