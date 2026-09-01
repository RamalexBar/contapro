import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createBrand, listBrands } from "../api/brand.api";

export function BrandsSection() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("brand.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["brands"], queryFn: listBrands });

  const [name, setName] = useState("");
  const createMutation = useMutation({
    mutationFn: () => createBrand({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setName("");
    },
  });

  return (
    <div className="space-y-6">
      {canManage && (
        <Card title="Nueva marca">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
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
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((b) => (
                <TableRow key={b.id}>
                  <Td className="font-medium text-slate-900">{b.name}</Td>
                </TableRow>
              ))}
              {data?.data.length === 0 && (
                <TableRow>
                  <Td className="text-center text-slate-400">Sin marcas todavia</Td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
