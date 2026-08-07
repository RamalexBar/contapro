import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  type AccountType,
  type WithholdingType,
  closeFinancialPeriod,
  createAccount,
  createCostCenter,
  createEntry,
  createWithholdingConcept,
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
  reopenFinancialPeriod,
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

function AccountsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["accounting", "accounts"], queryFn: listAccounts });
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET" as AccountType, parentId: "", acceptsEntries: true });

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
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      setForm({ code: "", name: "", type: "ASSET", parentId: "", acceptsEntries: true });
    },
  });

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva cuenta</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.parentId}
            onChange={(e) => setForm({ ...form, parentId: e.target.value })}
          >
            <option value="">(sin cuenta padre)</option>
            {data?.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Codigo</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Nivel</th>
              <th>Admite movimientos</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2">{a.code}</td>
                <td>{a.name}</td>
                <td>{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}</td>
                <td>{a.level}</td>
                <td>{a.acceptsEntries ? "Si" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
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
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo concepto de retencion</h2>
        <p className="mb-3 text-sm text-gray-500">
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
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as WithholdingType })}
          >
            {WITHHOLDING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Codigo</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Tarifa</th>
              <th>Codigo DIAN</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{c.code}</td>
                  <td>
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </td>
                  <td>{WITHHOLDING_TYPES.find((t) => t.value === c.type)?.label ?? c.type}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 rounded border border-gray-200 px-2 py-1"
                      value={editForm.ratePercent}
                      onChange={(e) => setEditForm({ ...editForm, ratePercent: e.target.value })}
                    />
                    %
                  </td>
                  <td>
                    <input
                      className="w-20 rounded border border-gray-200 px-2 py-1"
                      value={editForm.dianConceptCode}
                      onChange={(e) => setEditForm({ ...editForm, dianConceptCode: e.target.value })}
                    />
                  </td>
                  <td>{c.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(c.id)}>
                      Guardar
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{c.code}</td>
                  <td>{c.name}</td>
                  <td>{WITHHOLDING_TYPES.find((t) => t.value === c.type)?.label ?? c.type}</td>
                  <td>{c.ratePercent}%</td>
                  <td className={c.dianConceptCode ? "" : "text-yellow-600"}>{c.dianConceptCode ?? "Sin asignar"}</td>
                  <td>{c.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditForm({ name: c.name, ratePercent: String(c.ratePercent), dianConceptCode: c.dianConceptCode ?? "" });
                      }}
                    >
                      Editar
                    </Button>
                    {c.isActive && (
                      <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(c.id)}>
                        Desactivar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </Card>
    </>
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
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo centro de costo</h2>
        <p className="mb-3 text-sm text-gray-500">
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
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Codigo</th>
              <th>Nombre</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{c.code}</td>
                  <td>
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </td>
                  <td>{c.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(c.id)}>
                      Guardar
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                      }}
                    >
                      Editar
                    </Button>
                    {c.isActive && (
                      <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(c.id)}>
                        Desactivar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </Card>
    </>
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

  function updateLine(index: number, field: string, value: string) {
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo comprobante manual</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input placeholder="Descripcion" value={description} onChange={(e) => setDescription(e.target.value)} required />
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
            >
              <option value="">Sin centro de costo</option>
              {costCenters?.data.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </div>
          <table className="mb-3 w-full text-left text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="py-1">Cuenta</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Descripcion</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <select
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      value={line.accountId}
                      onChange={(e) => updateLine(i, "accountId", e.target.value)}
                    >
                      <option value="">Seleccionar...</option>
                      {accounts?.data
                        .filter((a) => a.acceptsEntries)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} {a.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="pr-2">
                    <input
                      type="number"
                      className="w-24 rounded border border-gray-200 px-2 py-1"
                      value={line.debit}
                      onChange={(e) => updateLine(i, "debit", e.target.value)}
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      type="number"
                      className="w-24 rounded border border-gray-200 px-2 py-1"
                      value={line.credit}
                      onChange={(e) => updateLine(i, "credit", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1"
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines([...lines, { accountId: "", debit: "", credit: "", description: "" }])}
            >
              + Linea
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Crear comprobante
            </Button>
          </div>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">#</th>
              <th>Fecha</th>
              <th>Descripcion</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries?.data.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100">
                <td className="py-2">{entry.number}</td>
                <td>{entry.date.slice(0, 10)}</td>
                <td>{entry.description}</td>
                <td>{entry.type}</td>
                <td>{entry.status}</td>
                <td className="space-x-2 py-2 text-right">
                  {entry.status === "DRAFT" && (
                    <Button onClick={() => postMutation.mutate(entry.id)} disabled={postMutation.isPending}>
                      Postear
                    </Button>
                  )}
                  {entry.status === "POSTED" && (
                    <Button variant="danger" onClick={() => voidMutation.mutate(entry.id)} disabled={voidMutation.isPending}>
                      Anular
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
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

  const { data: accounts } = useQuery({ queryKey: ["accounting", "accounts"], queryFn: listAccounts });
  const { data: costCenters } = useQuery({ queryKey: ["cost-centers"], queryFn: listCostCenters });
  const balanceQuery = useQuery({
    queryKey: ["accounting", "balance-sheet", asOf],
    queryFn: () => getBalanceSheet(asOf),
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
    <>
      <div className="mb-4 flex gap-2">
        {(["balance", "income", "cashflow", "ledger"] as ReportTab[]).map((tab) => (
          <Button key={tab} variant={reportTab === tab ? "primary" : "secondary"} onClick={() => setReportTab(tab)}>
            {tab === "balance" ? "Balance General" : tab === "income" ? "Estado de Resultados" : tab === "cashflow" ? "Flujo de caja" : "Libro mayor"}
          </Button>
        ))}
      </div>

      {reportTab === "balance" && (
        <Card>
          <div className="mb-4">
            <Input type="date" label="Fecha de corte" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          {balanceQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Activos ({formatCOP(balanceQuery.data.totalAssets)})</h3>
                {balanceQuery.data.assets.map((a) => (
                  <p key={a.accountId} className="text-sm text-gray-600">
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Pasivos ({formatCOP(balanceQuery.data.totalLiabilities)})</h3>
                {balanceQuery.data.liabilities.map((a) => (
                  <p key={a.accountId} className="text-sm text-gray-600">
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Patrimonio ({formatCOP(balanceQuery.data.totalEquity)}) — Utilidad: {formatCOP(balanceQuery.data.netIncome)}
                </h3>
                {balanceQuery.data.equity.map((a) => (
                  <p key={a.accountId} className="text-sm text-gray-600">
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
          <div className="mb-4 flex gap-3">
            <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Centro de costo</span>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={incomeCostCenterId}
                onChange={(e) => setIncomeCostCenterId(e.target.value)}
              >
                <option value="">Todos</option>
                {costCenters?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {incomeQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Ingresos ({formatCOP(incomeQuery.data.totalIncome)})</h3>
                {incomeQuery.data.income.map((a) => (
                  <p key={a.accountId} className="text-sm text-gray-600">
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Gastos ({formatCOP(incomeQuery.data.totalExpenses)})</h3>
                {incomeQuery.data.expenses.map((a) => (
                  <p key={a.accountId} className="text-sm text-gray-600">
                    {a.name}: {formatCOP(a.balance)}
                  </p>
                ))}
              </div>
              <p className="col-span-2 text-sm font-semibold">Utilidad neta: {formatCOP(incomeQuery.data.netIncome)}</p>
            </div>
          )}
        </Card>
      )}

      {reportTab === "cashflow" && (
        <Card>
          <div className="mb-4 flex gap-3">
            <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {cashFlowQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Caja — entradas {formatCOP(cashFlowQuery.data.totalCashIn)}, salidas {formatCOP(cashFlowQuery.data.totalCashOut)}, neto{" "}
                  {formatCOP(cashFlowQuery.data.netCash)}
                </h3>
                {cashFlowQuery.data.cash.map((l) => (
                  <p key={l.type} className="text-sm text-gray-600">
                    {l.type}: {formatCOP(l.total)}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Bancos — entradas {formatCOP(cashFlowQuery.data.totalBankIn)}, salidas {formatCOP(cashFlowQuery.data.totalBankOut)}, neto{" "}
                  {formatCOP(cashFlowQuery.data.netBank)}
                </h3>
                {cashFlowQuery.data.bank.map((l) => (
                  <p key={l.type} className="text-sm text-gray-600">
                    {l.type}: {formatCOP(l.total)}
                  </p>
                ))}
              </div>
              <p className="col-span-2 text-sm font-semibold">Flujo de caja neto: {formatCOP(cashFlowQuery.data.netCashFlow)}</p>
            </div>
          )}
        </Card>
      )}

      {reportTab === "ledger" && (
        <Card>
          <div className="mb-4 flex gap-3">
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={ledgerAccountId}
              onChange={(e) => setLedgerAccountId(e.target.value)}
            >
              <option value="">Seleccionar cuenta...</option>
              {accounts?.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
            <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={ledgerCostCenterId}
              onChange={(e) => setLedgerCostCenterId(e.target.value)}
            >
              <option value="">Todos los centros de costo</option>
              {costCenters?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </div>
          {ledgerQuery.data && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2">#</th>
                  <th>Fecha</th>
                  <th>Descripcion</th>
                  <th>Debito</th>
                  <th>Credito</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ledgerQuery.data.data.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{l.entryNumber}</td>
                    <td>{l.date.slice(0, 10)}</td>
                    <td>{l.description}</td>
                    <td>{formatCOP(l.debit)}</td>
                    <td>{formatCOP(l.credit)}</td>
                    <td>{formatCOP(l.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
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
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Cerrar periodo contable</h2>
        <p className="mb-3 text-sm text-gray-500">
          Al cerrar un periodo no se podran crear ni contabilizar comprobantes (manuales o automaticos) con fecha
          dentro de ese mes. Requiere que todos los comprobantes del mes esten publicados o anulados.
        </p>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            closeMutation.mutate();
          }}
        >
          <Input label="Año" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
          <div>
            <label className="mb-1 block text-sm text-gray-600">Mes</label>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={closeMutation.isPending}>
            Cerrar periodo
          </Button>
        </form>
        {closeMutation.isError && <p className="mt-2 text-sm text-red-600">{(closeMutation.error as Error).message}</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Historial de periodos</h2>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Periodo</th>
              <th>Estado</th>
              <th>Cerrado el</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">
                  {MONTH_LABELS[p.month - 1]} {p.year}
                </td>
                <td>{p.status === "CLOSED" ? "Cerrado" : "Abierto"}</td>
                <td>{p.closedAt ? p.closedAt.slice(0, 10) : "-"}</td>
                <td className="text-right">
                  {p.status === "CLOSED" && (
                    <Button
                      variant="secondary"
                      disabled={reopenMutation.isPending}
                      onClick={() => reopenMutation.mutate({ year: p.year, month: p.month })}
                    >
                      Reabrir
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay periodos cerrados todavia.</p>}
      </Card>
    </>
  );
}

export function AccountingPage() {
  const [section, setSection] = useState<Section>("accounts");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Contabilidad</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "accounts" ? "primary" : "secondary"} onClick={() => setSection("accounts")}>
          Plan de cuentas
        </Button>
        <Button variant={section === "entries" ? "primary" : "secondary"} onClick={() => setSection("entries")}>
          Comprobantes
        </Button>
        <Button variant={section === "reports" ? "primary" : "secondary"} onClick={() => setSection("reports")}>
          Reportes
        </Button>
        <Button variant={section === "periods" ? "primary" : "secondary"} onClick={() => setSection("periods")}>
          Cierre de periodo
        </Button>
        <Button variant={section === "withholding" ? "primary" : "secondary"} onClick={() => setSection("withholding")}>
          Retenciones
        </Button>
        <Button variant={section === "cost-centers" ? "primary" : "secondary"} onClick={() => setSection("cost-centers")}>
          Centros de costo
        </Button>
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
