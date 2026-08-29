import { useMemo, useState } from "react";
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
import { AccountCombobox } from "../components/AccountCombobox";
import {
  type AccountType,
  type WithholdingType,
  MAX_PRINCIPAL_ACCOUNT_LEVEL,
  activateAccount,
  closeFinancialPeriod,
  createAccount,
  createCostCenter,
  createEntry,
  createWithholdingConcept,
  deactivateAccount,
  deactivateCostCenter,
  deactivateWithholdingConcept,
  getBalanceSheet,
  getCashFlow,
  getIncomeStatement,
  getLedger,
  listAccounts,
  listCostCenters,
  listEntries,
  listFinancialPeriods,
  listWithholdingConcepts,
  postEntry,
  printJournalEntryPdf,
  reopenFinancialPeriod,
  updateAccount,
  updateCostCenter,
  updateWithholdingConcept,
  voidEntry,
} from "../api/accounting.api";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "ASSET", label: "Activo" },
  { value: "LIABILITY", label: "Pasivo" },
  { value: "EQUITY", label: "Patrimonio" },
  { value: "INCOME", label: "Ingreso" },
  { value: "EXPENSE", label: "Gasto" },
];

const ENTRY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Confirmado",
  VOID: "Anulado",
};

const WITHHOLDING_TYPES: { value: WithholdingType; label: string }[] = [
  { value: "RETEFUENTE", label: "Retencion en la fuente" },
  { value: "RETEICA", label: "ReteICA" },
  { value: "RETEIVA", label: "ReteIVA" },
];

type Section = "accounts" | "entries" | "reports" | "periods" | "withholding" | "cost-centers";
type ReportTab = "balance" | "income" | "cashflow" | "ledger";

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return formatLocalDate(new Date());
}

function monthAgoStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatLocalDate(d);
}

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

function AccountsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["accounting", "accounts"], queryFn: listAccounts });
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET" as AccountType, parentId: "", acceptsEntries: true });
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createAccount({
        code: form.code,
        name: form.name,
        type: form.type,
        parentId: form.parentId || undefined,
        acceptsEntries: form.acceptsEntries,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ code: "", name: "", type: "ASSET", parentId: "", acceptsEntries: true });
    },
  });

  const activateMutation = useMutation({ mutationFn: activateAccount, onSuccess: invalidate });
  const deactivateMutation = useMutation({ mutationFn: deactivateAccount, onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: (id: string) => updateAccount(id, { name: editName }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const accounts = data?.data ?? [];
  const filtered = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((a) => a.code.startsWith(q) || a.name.toLowerCase().includes(q));
  }, [accounts, search]);

  return (
    <div className="space-y-6">
      <Card title="Nueva cuenta">
        <p className="mb-3 text-sm text-slate-500">
          El plan de cuentas estandar ya viene precargado abajo -- usa esta seccion solo para agregar una subcuenta o
          auxiliar que no este en el catalogo. Si eliges como padre una cuenta base (clase/grupo/cuenta) que hoy admite
          movimientos, al crear su primera subcuenta esa cuenta base deja de admitirlos -- el movimiento pasa al
          detalle nuevo.
        </p>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <AccountCombobox
            accounts={accounts}
            value={form.parentId}
            onChange={(id) => setForm({ ...form, parentId: id })}
            filter={() => true}
            placeholder="(sin cuenta padre)"
          />
          <Button type="submit" loading={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(createMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card title="Plan unico de cuentas (PUC)">
        <p className="mb-3 text-sm text-slate-500">
          Catalogo estandar precargado con toda la jerarquia (clase, grupo, cuenta, subcuenta). Busca por codigo -- por
          ejemplo "15" muestra ese grupo y todas sus cuentas -- y activa con un clic las que vayas a usar, sin
          necesidad de crearlas ni escribir el nombre.
        </p>
        <Input
          placeholder="Buscar por codigo o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Codigo</Th>
                <Th>Nombre</Th>
                <Th>Tipo</Th>
                <Th>Admite movimientos</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {filtered.map((a) => {
                const isEditable = a.level > MAX_PRINCIPAL_ACCOUNT_LEVEL;
                const isEditing = editingId === a.id;
                return (
                  <TableRow key={a.id}>
                    <Td className="font-mono text-xs text-slate-900">{a.code}</Td>
                    <Td style={{ paddingLeft: 12 + (a.level - 1) * 16 }}>
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        a.name
                      )}
                    </Td>
                    <Td>{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}</Td>
                    <Td>{a.acceptsEntries ? "Si" : "No"}</Td>
                    <Td>
                      <ActiveBadge active={a.isActive} />
                    </Td>
                    <Td className="space-x-2 text-right">
                      {isEditing ? (
                        <>
                          <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(a.id)}>
                            Guardar
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          {isEditable && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingId(a.id);
                                setEditName(a.name);
                              }}
                            >
                              Editar
                            </Button>
                          )}
                          {a.acceptsEntries &&
                            (a.isActive ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={deactivateMutation.isPending}
                                onClick={() => deactivateMutation.mutate(a.id)}
                              >
                                Desactivar
                              </Button>
                            ) : (
                              <Button size="sm" loading={activateMutation.isPending} onClick={() => activateMutation.mutate(a.id)}>
                                Activar
                              </Button>
                            ))}
                        </>
                      )}
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!isLoading && filtered.length === 0 && <p className="p-4 text-sm text-slate-400">Sin resultados.</p>}
      </Card>
    </div>
  );
}

function WithholdingSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["withholding-concepts"], queryFn: listWithholdingConcepts });
  const [form, setForm] = useState({ code: "", name: "", type: "RETEFUENTE" as WithholdingType, ratePercent: "", dianConceptCode: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", ratePercent: "", dianConceptCode: "" });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["withholding-concepts"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createWithholdingConcept({
        code: form.code,
        name: form.name,
        type: form.type,
        ratePercent: Number(form.ratePercent),
        dianConceptCode: form.dianConceptCode || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ code: "", name: "", type: "RETEFUENTE", ratePercent: "", dianConceptCode: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      updateWithholdingConcept(id, {
        name: editForm.name,
        ratePercent: Number(editForm.ratePercent),
        dianConceptCode: editForm.dianConceptCode || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateWithholdingConcept,
    onSuccess: () => invalidate(),
  });

  return (
    <div className="space-y-6">
      <Card title="Nuevo concepto de retencion">
        <p className="mb-3 text-sm text-slate-500">
          Cada venta o compra puede aplicar uno o mas de estos conceptos. Las tarifas de ReteFuente/ReteIVA de
          fabrica son valores comunes de mercado; ajusta la de ICA a la tarifa real de tu municipio/actividad.
        </p>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as WithholdingType })}>
            {WITHHOLDING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
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
          <Input
            placeholder="Codigo DIAN retencion (opcional, ej. 1301)"
            value={form.dianConceptCode}
            onChange={(e) => setForm({ ...form, dianConceptCode: e.target.value })}
          />
          <Button type="submit" loading={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(createMutation.error as Error).message}
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
                <Th>Codigo</Th>
                <Th>Nombre</Th>
                <Th>Tipo</Th>
                <Th>Tarifa</Th>
                <Th>Codigo DIAN</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) =>
                editingId === c.id ? (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-slate-900">{c.code}</Td>
                    <Td>
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </Td>
                    <Td>{WITHHOLDING_TYPES.find((t) => t.value === c.type)?.label ?? c.type}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="w-20"
                          value={editForm.ratePercent}
                          onChange={(e) => setEditForm({ ...editForm, ratePercent: e.target.value })}
                        />
                        %
                      </div>
                    </Td>
                    <Td>
                      <Input
                        className="w-24"
                        value={editForm.dianConceptCode}
                        onChange={(e) => setEditForm({ ...editForm, dianConceptCode: e.target.value })}
                      />
                    </Td>
                    <Td>
                      <ActiveBadge active={c.isActive} />
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(c.id)}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </Td>
                  </TableRow>
                ) : (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-slate-900">{c.code}</Td>
                    <Td>{c.name}</Td>
                    <Td>{WITHHOLDING_TYPES.find((t) => t.value === c.type)?.label ?? c.type}</Td>
                    <Td>{c.ratePercent}%</Td>
                    <Td className={c.dianConceptCode ? "" : "text-warning-600"}>{c.dianConceptCode ?? "Sin asignar"}</Td>
                    <Td>
                      <ActiveBadge active={c.isActive} />
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditForm({ name: c.name, ratePercent: String(c.ratePercent), dianConceptCode: c.dianConceptCode ?? "" });
                        }}
                      >
                        Editar
                      </Button>
                      {c.isActive && (
                        <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(c.id)}>
                          Desactivar
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function CostCentersSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cost-centers"], queryFn: listCostCenters });
  const [form, setForm] = useState({ code: "", name: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createCostCenter(form),
    onSuccess: () => {
      invalidate();
      setForm({ code: "", name: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCostCenter(id, { name: editName }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateCostCenter,
    onSuccess: () => invalidate(),
  });

  return (
    <div className="space-y-6">
      <Card title="Nuevo centro de costo">
        <p className="mb-3 text-sm text-slate-500">
          Etiqueta comprobantes manuales y gastos operativos por area/proyecto (ej. sucursal, departamento) para
          poder filtrar el Estado de Resultados y el Libro Mayor por ese mismo centro.
        </p>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Button type="submit" loading={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(createMutation.error as Error).message}
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
                <Th>Codigo</Th>
                <Th>Nombre</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) =>
                editingId === c.id ? (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-slate-900">{c.code}</Td>
                    <Td>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </Td>
                    <Td>
                      <ActiveBadge active={c.isActive} />
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(c.id)}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </Td>
                  </TableRow>
                ) : (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-slate-900">{c.code}</Td>
                    <Td>{c.name}</Td>
                    <Td>
                      <ActiveBadge active={c.isActive} />
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                      >
                        Editar
                      </Button>
                      {c.isActive && (
                        <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(c.id)}>
                          Desactivar
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function EntriesSection() {
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useQuery({ queryKey: ["accounting", "entries"], queryFn: () => listEntries() });
  const { data: accounts } = useQuery({ queryKey: ["accounting", "accounts"], queryFn: listAccounts });
  const { data: costCenters } = useQuery({ queryKey: ["cost-centers"], queryFn: listCostCenters });

  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [lines, setLines] = useState([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);

  const createMutation = useMutation({
    mutationFn: () =>
      createEntry({
        date,
        description,
        costCenterId: costCenterId || undefined,
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] });
      setDescription("");
      setCostCenterId("");
      setLines([
        { accountId: "", debit: "", credit: "", description: "" },
        { accountId: "", debit: "", credit: "", description: "" },
      ]);
    },
  });

  const postMutation = useMutation({
    mutationFn: postEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] }),
  });
  const voidMutation = useMutation({
    mutationFn: voidEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] }),
  });
  const printMutation = useMutation({ mutationFn: printJournalEntryPdf });

  function updateLine(index: number, field: string, value: string) {
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function entryStatusTone(status: string): "neutral" | "success" | "danger" {
    if (status === "POSTED") return "success";
    if (status === "VOID") return "danger";
    return "neutral";
  }

  return (
    <div className="space-y-6">
      <Card title="Nuevo comprobante manual">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input placeholder="Descripcion" value={description} onChange={(e) => setDescription(e.target.value)} required />
            <Select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
              <option value="">Sin centro de costo</option>
              {costCenters?.data
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.name}
                  </option>
                ))}
            </Select>
          </div>
          <Table className="mb-3">
            <TableHead>
              <tr>
                <Th>Cuenta</Th>
                <Th>Debito</Th>
                <Th>Credito</Th>
                <Th>Descripcion</Th>
              </tr>
            </TableHead>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <Td className="pr-2">
                    <AccountCombobox
                      accounts={accounts?.data ?? []}
                      value={line.accountId}
                      onChange={(id) => updateLine(i, "accountId", id)}
                    />
                  </Td>
                  <Td className="pr-2">
                    <Input type="number" className="w-28" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} />
                  </Td>
                  <Td className="pr-2">
                    <Input type="number" className="w-28" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} />
                  </Td>
                  <Td>
                    <Input value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines([...lines, { accountId: "", debit: "", credit: "", description: "" }])}
            >
              + Linea
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Crear comprobante
            </Button>
          </div>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(createMutation.error as Error).message}
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
                <Th>#</Th>
                <Th>Fecha</Th>
                <Th>Descripcion</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {entries?.data.map((entry) => (
                <TableRow key={entry.id}>
                  <Td className="font-medium text-slate-900">{entry.number}</Td>
                  <Td>{entry.date.slice(0, 10)}</Td>
                  <Td>{entry.description}</Td>
                  <Td>{entry.type}</Td>
                  <Td>
                    <Badge tone={entryStatusTone(entry.status)}>{ENTRY_STATUS_LABEL[entry.status] ?? entry.status}</Badge>
                  </Td>
                  <Td className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => printMutation.mutate(entry.id)}
                      loading={printMutation.isPending && printMutation.variables === entry.id}
                    >
                      Imprimir
                    </Button>
                    {entry.status === "DRAFT" && (
                      <Button size="sm" onClick={() => postMutation.mutate(entry.id)} loading={postMutation.isPending}>
                        Confirmar comprobante
                      </Button>
                    )}
                    {entry.status === "POSTED" && (
                      <Button size="sm" variant="danger" onClick={() => voidMutation.mutate(entry.id)} loading={voidMutation.isPending}>
                        Anular comprobante
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ReportsSection() {
  const [reportTab, setReportTab] = useState<ReportTab>("balance");
  const [asOf, setAsOf] = useState(todayStr());
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [incomeCostCenterId, setIncomeCostCenterId] = useState("");
  const [ledgerCostCenterId, setLedgerCostCenterId] = useState("");
  const [showCode, setShowCode] = useState(true);
  const [byThirdParty, setByThirdParty] = useState(false);

  const { data: accounts } = useQuery({ queryKey: ["accounting", "accounts"], queryFn: listAccounts });
  const { data: costCenters } = useQuery({ queryKey: ["cost-centers"], queryFn: listCostCenters });
  const balanceQuery = useQuery({
    queryKey: ["accounting", "balance-sheet", asOf, byThirdParty],
    queryFn: () => getBalanceSheet(asOf, byThirdParty),
    enabled: reportTab === "balance",
  });
  const incomeQuery = useQuery({
    queryKey: ["accounting", "income-statement", from, to, incomeCostCenterId],
    queryFn: () => getIncomeStatement(from, to, incomeCostCenterId || undefined),
    enabled: reportTab === "income",
  });
  const cashFlowQuery = useQuery({
    queryKey: ["accounting", "cash-flow", from, to],
    queryFn: () => getCashFlow(from, to),
    enabled: reportTab === "cashflow",
  });
  const ledgerQuery = useQuery({
    queryKey: ["accounting", "ledger", ledgerAccountId, from, to, ledgerCostCenterId],
    queryFn: () => getLedger(ledgerAccountId, from, to, ledgerCostCenterId || undefined),
    enabled: reportTab === "ledger" && !!ledgerAccountId,
  });

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(["balance", "income", "cashflow", "ledger"] as ReportTab[]).map((tab) => (
            <Button key={tab} size="sm" variant={reportTab === tab ? "primary" : "secondary"} onClick={() => setReportTab(tab)}>
              {tab === "balance" ? "Balance General" : tab === "income" ? "Estado de Resultados" : tab === "cashflow" ? "Flujo de caja" : "Libro mayor"}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>

      {reportTab === "balance" && (
        <Card>
          <div className="no-print mb-4 flex flex-wrap items-end gap-4">
            <Input type="date" label="Fecha de corte" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={showCode} onChange={(e) => setShowCode(e.target.checked)} />
              Mostrar código
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={byThirdParty} onChange={(e) => setByThirdParty(e.target.checked)} />
              Con terceros (Clientes/Proveedores por cliente/proveedor)
            </label>
          </div>
          <p className="mb-2 hidden text-sm text-slate-500 print:block">Corte al {asOf}</p>
          {balanceQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Activos ({formatCOP(balanceQuery.data.totalAssets)})</h3>
                {balanceQuery.data.assets.map((a, i) => (
                  <p key={`${a.accountId}-${a.thirdPartyName ?? i}`} className="text-sm text-slate-600">
                    {showCode ? `${a.code} ` : ""}
                    {a.name}
                    {a.thirdPartyName ? ` — ${a.thirdPartyName}` : ""}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Pasivos ({formatCOP(balanceQuery.data.totalLiabilities)})</h3>
                {balanceQuery.data.liabilities.map((a, i) => (
                  <p key={`${a.accountId}-${a.thirdPartyName ?? i}`} className="text-sm text-slate-600">
                    {showCode ? `${a.code} ` : ""}
                    {a.name}
                    {a.thirdPartyName ? ` — ${a.thirdPartyName}` : ""}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Patrimonio ({formatCOP(balanceQuery.data.totalEquity)}) — Utilidad: {formatCOP(balanceQuery.data.netIncome)}
                </h3>
                {balanceQuery.data.equity.map((a) => (
                  <p key={a.accountId} className="text-sm text-slate-600">
                    {showCode ? `${a.code} ` : ""}
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {reportTab === "income" && (
        <Card>
          <div className="no-print mb-4 flex flex-wrap items-end gap-3">
            <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select label="Centro de costo" value={incomeCostCenterId} onChange={(e) => setIncomeCostCenterId(e.target.value)}>
              <option value="">Todos</option>
              {costCenters?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="mb-2 hidden text-sm text-slate-500 print:block">Del {from} al {to}</p>
          {incomeQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Ingresos ({formatCOP(incomeQuery.data.totalIncome)})</h3>
                {incomeQuery.data.income.map((a) => (
                  <p key={a.accountId} className="text-sm text-slate-600">
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Gastos ({formatCOP(incomeQuery.data.totalExpenses)})</h3>
                {incomeQuery.data.expenses.map((a) => (
                  <p key={a.accountId} className="text-sm text-slate-600">
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <p className="col-span-2 text-sm font-semibold text-slate-900">Utilidad neta: {formatCOP(incomeQuery.data.netIncome)}</p>
            </div>
          )}
        </Card>
      )}

      {reportTab === "cashflow" && (
        <Card>
          <div className="no-print mb-4 flex flex-wrap items-end gap-3">
            <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <p className="mb-2 hidden text-sm text-slate-500 print:block">Del {from} al {to}</p>
          {cashFlowQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Caja — entradas {formatCOP(cashFlowQuery.data.totalCashIn)}, salidas {formatCOP(cashFlowQuery.data.totalCashOut)}, neto{" "}
                  {formatCOP(cashFlowQuery.data.netCash)}
                </h3>
                {cashFlowQuery.data.cash.map((l) => (
                  <p key={l.type} className="text-sm text-slate-600">
                    {l.type}: {formatCOP(l.total)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Bancos — entradas {formatCOP(cashFlowQuery.data.totalBankIn)}, salidas {formatCOP(cashFlowQuery.data.totalBankOut)}, neto{" "}
                  {formatCOP(cashFlowQuery.data.netBank)}
                </h3>
                {cashFlowQuery.data.bank.map((l) => (
                  <p key={l.type} className="text-sm text-slate-600">
                    {l.type}: {formatCOP(l.total)}
                  </p>
                ))}
              </div>
              <p className="col-span-2 text-sm font-semibold text-slate-900">Flujo de caja neto: {formatCOP(cashFlowQuery.data.netCashFlow)}</p>
            </div>
          )}
        </Card>
      )}

      {reportTab === "ledger" && (
        <Card>
          <div className="no-print mb-4 flex flex-wrap items-end gap-3">
            <div className="w-64">
              <span className="mb-1 block text-sm font-medium text-slate-700">Cuenta</span>
              <AccountCombobox accounts={accounts?.data ?? []} value={ledgerAccountId} onChange={setLedgerAccountId} />
            </div>
            <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select label="Centro de costo" value={ledgerCostCenterId} onChange={(e) => setLedgerCostCenterId(e.target.value)}>
              <option value="">Todos los centros de costo</option>
              {costCenters?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="mb-2 hidden text-sm text-slate-500 print:block">
            {accounts?.data.find((a) => a.id === ledgerAccountId)?.name} — Del {from} al {to}
          </p>
          {ledgerQuery.data && (
            <Table>
              <TableHead>
                <tr>
                  <Th>#</Th>
                  <Th>Fecha</Th>
                  <Th>Descripcion</Th>
                  <Th>Debito</Th>
                  <Th>Credito</Th>
                  <Th>Saldo</Th>
                </tr>
              </TableHead>
              <TableBody>
                {ledgerQuery.data.data.map((l, i) => (
                  <TableRow key={i}>
                    <Td>{l.entryNumber}</Td>
                    <Td>{l.date.slice(0, 10)}</Td>
                    <Td>{l.description}</Td>
                    <Td>{formatCOP(l.debit)}</Td>
                    <Td>{formatCOP(l.credit)}</Td>
                    <Td>{formatCOP(l.runningBalance)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function PeriodsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["accounting", "financial-periods"], queryFn: () => listFinancialPeriods() });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const closeMutation = useMutation({
    mutationFn: () => closeFinancialPeriod(year, month),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting", "financial-periods"] }),
  });
  const reopenMutation = useMutation({
    mutationFn: (period: { year: number; month: number }) => reopenFinancialPeriod(period.year, period.month),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting", "financial-periods"] }),
  });

  return (
    <div className="space-y-6">
      <Card title="Cerrar periodo contable">
        <p className="mb-3 text-sm text-slate-500">
          Al cerrar un periodo no se podran crear ni contabilizar comprobantes (manuales o automaticos) con fecha
          dentro de ese mes. Requiere que todos los comprobantes del mes esten publicados o anulados.
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            closeMutation.mutate();
          }}
        >
          <Input label="Año" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
          <Select label="Mes" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={closeMutation.isPending}>
            Cerrar periodo
          </Button>
        </form>
        {closeMutation.isError && (
          <Alert tone="danger" className="mt-3">
            {(closeMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card title="Historial de periodos" noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <Table>
              <TableHead>
                <tr>
                  <Th>Periodo</Th>
                  <Th>Estado</Th>
                  <Th>Cerrado el</Th>
                  <Th></Th>
                </tr>
              </TableHead>
              <TableBody>
                {data?.data.map((p) => (
                  <TableRow key={p.id}>
                    <Td className="font-medium text-slate-900">
                      {MONTH_LABELS[p.month - 1]} {p.year}
                    </Td>
                    <Td>
                      <Badge tone={p.status === "CLOSED" ? "neutral" : "success"}>{p.status === "CLOSED" ? "Cerrado" : "Abierto"}</Badge>
                    </Td>
                    <Td>{p.closedAt ? p.closedAt.slice(0, 10) : "-"}</Td>
                    <Td className="text-right">
                      {p.status === "CLOSED" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={reopenMutation.isPending}
                          onClick={() => reopenMutation.mutate({ year: p.year, month: p.month })}
                        >
                          Reabrir
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data?.data.length === 0 && <p className="p-4 text-sm text-slate-400">No hay periodos cerrados todavia.</p>}
          </>
        )}
      </Card>
    </div>
  );
}

const SECTIONS: { value: Section; label: string }[] = [
  { value: "accounts", label: "Plan de cuentas" },
  { value: "entries", label: "Comprobantes" },
  { value: "reports", label: "Reportes" },
  { value: "periods", label: "Cierre de periodo" },
  { value: "withholding", label: "Retenciones" },
  { value: "cost-centers", label: "Centros de costo" },
];

export function AccountingPage() {
  const [section, setSection] = useState<Section>("accounts");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Contabilidad</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {SECTIONS.map((s) => (
          <Button key={s.value} size="sm" variant={section === s.value ? "primary" : "secondary"} onClick={() => setSection(s.value)}>
            {s.label}
          </Button>
        ))}
      </div>

      {section === "accounts" && <AccountsSection />}
      {section === "entries" && <EntriesSection />}
      {section === "reports" && <ReportsSection />}
      {section === "periods" && <PeriodsSection />}
      {section === "withholding" && <WithholdingSection />}
      {section === "cost-centers" && <CostCentersSection />}
    </AppLayout>
  );
}
