import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createCategory, listCategories } from "../api/category.api";

export function CategoriesSection() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("category.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [form, setForm] = useState({ name: "", parentId: "" });
  const createMutation = useMutation({
    mutationFn: () => createCategory({ name: form.name, parentId: form.parentId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setForm({ name: "", parentId: "" });
    },
  });

  function parentName(parentId: string | null) {
    if (!parentId) return "-";
    return data?.data.find((c) => c.id === parentId)?.name ?? "-";
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card title="Nueva categoria">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">Sin categoria padre</option>
              {data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nombre</Th>
                <Th>Categoria padre</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) => (
                <TableRow key={c.id}>
                  <Td className="font-medium text-slate-900">{c.name}</Td>
                  <Td>{parentName(c.parentId)}</Td>
                </TableRow>
              ))}
              {data?.data.length === 0 && (
                <TableRow>
                  <Td colSpan={2} className="text-center text-slate-400">
                    Sin categorias todavia
                  </Td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
