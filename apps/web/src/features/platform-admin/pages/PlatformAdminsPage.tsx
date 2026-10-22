import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { usePlatformAuthStore } from "../hooks/usePlatformAuthStore";
import { createPlatformAdmin, listPlatformAdmins, setPlatformAdminActive } from "../api/saas-admin.api";

const EMPTY_FORM = { fullName: "", email: "", password: "" };

/** Operadores del panel de plataforma: todos tienen acceso total (PlatformAdmin no tiene roles). */
export function PlatformAdminsPage() {
  const queryClient = useQueryClient();
  const myId = usePlatformAuthStore((s) => s.platformAdmin?.id);
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "platform-admins"], queryFn: listPlatformAdmins });
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["saas-admin", "platform-admins"] });

  const createMutation = useMutation({
    mutationFn: () => createPlatformAdmin(form),
    onSuccess: (admin) => {
      refresh();
      setCreated(admin.email);
      setForm(EMPTY_FORM);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setPlatformAdminActive(id, isActive),
    onSuccess: refresh,
  });

  return (
    <PlatformAdminLayout>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Administradores</h1>
      <p className="mb-4 text-sm text-slate-600">
        Personas que pueden entrar a este panel. Todas tienen acceso total: empresas, planes, suscripciones y pagos.
      </p>

      <Card title="Nuevo administrador" className="mb-6">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setCreated(null);
            createMutation.mutate();
          }}
        >
          <Input
            label="Nombre completo"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          <Input
            label="Correo"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            hint="Mínimo 8 caracteres"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
          <Button type="submit" loading={createMutation.isPending}>
            Crear administrador
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(createMutation.error as Error).message}
          </Alert>
        )}
        {created && (
          <Alert tone="success" className="mt-3">
            Listo: {created} ya puede entrar en {window.location.origin}/admin/login con la contraseña que le pusiste.
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Estado</Th>
                <Th>Acción</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((a) => (
                <TableRow key={a.id}>
                  <Td>
                    {a.fullName}
                    {a.id === myId && <span className="ml-2 text-xs text-slate-500">(tú)</span>}
                  </Td>
                  <Td>{a.email}</Td>
                  <Td>
                    <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "Activo" : "Desactivado"}</Badge>
                  </Td>
                  <Td>
                    {a.id !== myId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={toggleMutation.isPending && toggleMutation.variables?.id === a.id}
                        onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
                      >
                        {a.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {toggleMutation.isError && (
          <Alert tone="danger" className="m-3">
            {(toggleMutation.error as Error).message}
          </Alert>
        )}
      </Card>
    </PlatformAdminLayout>
  );
}
