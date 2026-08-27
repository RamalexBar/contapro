import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  closeBankReconciliation,
  createBankAccount,
  getSuggestedBankReconciliationMatches,
  listBankAccounts,
  listBankReconciliations,
  listBankTransactions,
  matchBankReconciliationItem,
  registerBankTransaction,
  startBankReconciliation,
} from "../api/banking.api";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BankAccountsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["banking", "accounts"], queryFn: listBankAccounts });
  const [form, setForm] = useState({ bankName: "", accountNumber: "", accountType: "AHORROS" });

  const createMutation = useMutation({
    mutationFn: () => createBankAccount(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "accounts"] });
      setForm({ bankName: "", accountNumber: "", accountType: "AHORROS" });
    },
  });

  return (
    <div className="space-y-6">
      <Card title="Nueva cuenta bancaria">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Banco" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
          <Input
            placeholder="Numero de cuenta"
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            required
          />
          <Select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
            <option value="AHORROS">Ahorros</option>
            <option value="CORRIENTE">Corriente</option>
          </Select>
          <Button type="submit" loading={createMutation.isPending}>
            Crear
          </Button>
        </form>
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay cuentas bancarias registradas" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Banco</Th>
                <Th>Numero</Th>
                <Th>Tipo</Th>
                <Th>Saldo</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((a) => (
                <TableRow key={a.id}>
                  <Td className="font-medium text-slate-900">{a.bankName}</Td>
                  <Td>{a.accountNumber}</Td>
                  <Td>{a.accountType}</Td>
                  <Td>{formatCOP(a.currentBalance)}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function BankTransactionsSection() {
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ["banking", "accounts"], queryFn: listBankAccounts });
  const [bankAccountId, setBankAccountId] = useState("");
  const { data: transactions } = useQuery({
    queryKey: ["banking", "transactions", bankAccountId],
    queryFn: () => listBankTransactions(bankAccountId),
    enabled: !!bankAccountId,
  });

  const [form, setForm] = useState({ date: todayStr(), description: "", amount: "", type: "CREDIT" as "DEBIT" | "CREDIT" });
  const createMutation = useMutation({
    mutationFn: () => registerBankTransaction(bankAccountId, { ...form, amount: Number(form.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "transactions", bankAccountId] });
      setForm({ date: todayStr(), description: "", amount: "", type: "CREDIT" });
    },
  });

  return (
    <div className="space-y-6">
      <Card title="Movimientos bancarios">
        <Select className="mb-4" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
          <option value="">Seleccionar cuenta bancaria...</option>
          {accounts?.data.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bankName} {a.accountNumber}
            </option>
          ))}
        </Select>

        {bankAccountId && (
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <Input
              placeholder="Descripcion"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
            <Input
              type="number"
              placeholder="Monto"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "DEBIT" | "CREDIT" })}>
              <option value="CREDIT">Credito (entrada)</option>
              <option value="DEBIT">Debito (salida)</option>
            </Select>
            <Button type="submit" loading={createMutation.isPending}>
              Registrar
            </Button>
          </form>
        )}
      </Card>

      {bankAccountId && (
        <Card noPadding>
          {transactions?.data.length === 0 ? (
            <EmptyState title="Sin movimientos" />
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Descripcion</Th>
                  <Th>Tipo</Th>
                  <Th>Monto</Th>
                  <Th>Conciliado</Th>
                  <Th>Id</Th>
                </tr>
              </TableHead>
              <TableBody>
                {transactions?.data.map((t) => (
                  <TableRow key={t.id}>
                    <Td>{t.date.slice(0, 10)}</Td>
                    <Td>{t.description}</Td>
                    <Td>{t.type}</Td>
                    <Td>{formatCOP(t.amount)}</Td>
                    <Td>
                      <Badge tone={t.reconciled ? "success" : "neutral"}>{t.reconciled ? "Si" : "No"}</Badge>
                    </Td>
                    <Td className="font-mono text-xs text-slate-400">{t.id}</Td>
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

function SuggestedMatchesList({
  reconciliationId,
  onConfirm,
  confirming,
}: {
  reconciliationId: string;
  onConfirm: (bankTransactionId: string, journalEntryLineId: string) => void;
  confirming: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["banking", "suggested-matches", reconciliationId],
    queryFn: () => getSuggestedBankReconciliationMatches(reconciliationId),
  });

  const suggestions = data?.data ?? [];

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-500">Sugerencias de conciliacion</p>
      {isLoading ? (
        <Spinner />
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-slate-400">Sin sugerencias por ahora (monto exacto dentro de &plusmn;5 dias).</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div
              key={`${s.bankTransactionId}-${s.journalEntryLineId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2"
            >
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-900">{formatCOP(s.amount)}</span> &middot; banco {s.bankTransactionDate.slice(0, 10)}{" "}
                &middot; comprobante #{s.journalEntryNumber} ({s.journalEntryDate.slice(0, 10)})
                {s.daysApart > 0 && <span> &middot; {s.daysApart} dia(s) de diferencia</span>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={s.confidence === "EXACT" ? "success" : "warning"}>{s.confidence === "EXACT" ? "Exacta" : "Probable"}</Badge>
                <Button size="sm" onClick={() => onConfirm(s.bankTransactionId, s.journalEntryLineId)} loading={confirming}>
                  Confirmar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReconciliationsSection() {
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ["banking", "accounts"], queryFn: listBankAccounts });
  const { data: reconciliations, isLoading } = useQuery({
    queryKey: ["banking", "reconciliations"],
    queryFn: listBankReconciliations,
  });

  const [form, setForm] = useState({
    bankAccountId: "",
    periodStart: todayStr(),
    periodEnd: todayStr(),
    statementBalance: "",
    bookBalance: "",
  });
  const startMutation = useMutation({
    mutationFn: () =>
      startBankReconciliation({
        ...form,
        statementBalance: Number(form.statementBalance),
        bookBalance: Number(form.bookBalance),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banking", "reconciliations"] }),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [matchForm, setMatchForm] = useState({ bankTransactionId: "", journalEntryLineId: "" });
  const matchMutation = useMutation({
    mutationFn: ({ id, bankTransactionId, journalEntryLineId }: { id: string; bankTransactionId?: string; journalEntryLineId?: string }) =>
      matchBankReconciliationItem(id, { bankTransactionId, journalEntryLineId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["banking", "reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["banking", "suggested-matches", variables.id] });
      setMatchForm({ bankTransactionId: "", journalEntryLineId: "" });
    },
  });
  const closeMutation = useMutation({
    mutationFn: closeBankReconciliation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banking", "reconciliations"] }),
  });

  return (
    <div className="space-y-6">
      <Card title="Iniciar conciliacion">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            startMutation.mutate();
          }}
        >
          <Select value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })} required>
            <option value="">Cuenta bancaria...</option>
            {accounts?.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} {a.accountNumber}
              </option>
            ))}
          </Select>
          <Input type="date" label="Inicio periodo" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
          <Input type="date" label="Fin periodo" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
          <Input
            type="number"
            placeholder="Saldo extracto"
            value={form.statementBalance}
            onChange={(e) => setForm({ ...form, statementBalance: e.target.value })}
            required
          />
          <Input
            type="number"
            placeholder="Saldo libros"
            value={form.bookBalance}
            onChange={(e) => setForm({ ...form, bookBalance: e.target.value })}
            required
          />
          <Button type="submit" loading={startMutation.isPending}>
            Iniciar
          </Button>
        </form>
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Periodo</Th>
                <Th>Extracto</Th>
                <Th>Libros</Th>
                <Th>Diferencia</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {reconciliations?.data.map((r) => (
                <Fragment key={r.id}>
                  <TableRow>
                    <Td className="font-medium text-slate-900">
                      {r.periodStart.slice(0, 10)} - {r.periodEnd.slice(0, 10)}
                    </Td>
                    <Td>{formatCOP(r.statementBalance)}</Td>
                    <Td>{formatCOP(r.bookBalance)}</Td>
                    <Td>{formatCOP(r.statementBalance - r.bookBalance)}</Td>
                    <Td>
                      <Badge tone={r.status === "CLOSED" ? "success" : "neutral"}>{r.status}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                        {expandedId === r.id ? "Ocultar" : "Ver"}
                      </Button>
                    </Td>
                  </TableRow>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-semibold text-slate-500">Items conciliados</p>
                        {r.items.map((item) => (
                          <p key={item.id} className="text-xs text-slate-600">
                            BankTransaction: {item.bankTransactionId ?? "-"} / JournalEntryLine: {item.journalEntryLineId ?? "-"}
                          </p>
                        ))}
                        {r.items.length === 0 && <p className="text-xs text-slate-400">Sin items todavia.</p>}

                        {r.status === "IN_PROGRESS" && (
                          <>
                            <SuggestedMatchesList
                              reconciliationId={r.id}
                              onConfirm={(bankTransactionId, journalEntryLineId) =>
                                matchMutation.mutate({ id: r.id, bankTransactionId, journalEntryLineId })
                              }
                              confirming={matchMutation.isPending}
                            />

                            <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">Emparejar a mano</p>
                            <div className="flex flex-wrap items-end gap-2">
                              <Input
                                placeholder="bankTransactionId"
                                value={matchForm.bankTransactionId}
                                onChange={(e) => setMatchForm({ ...matchForm, bankTransactionId: e.target.value })}
                              />
                              <Input
                                placeholder="journalEntryLineId"
                                value={matchForm.journalEntryLineId}
                                onChange={(e) => setMatchForm({ ...matchForm, journalEntryLineId: e.target.value })}
                              />
                              <Button
                                size="sm"
                                onClick={() =>
                                  matchMutation.mutate({
                                    id: r.id,
                                    bankTransactionId: matchForm.bankTransactionId || undefined,
                                    journalEntryLineId: matchForm.journalEntryLineId || undefined,
                                  })
                                }
                                loading={matchMutation.isPending}
                              >
                                Emparejar
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => closeMutation.mutate(r.id)} loading={closeMutation.isPending}>
                                Cerrar conciliacion
                              </Button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

type BankSection = "accounts" | "transactions" | "reconciliations";

export function BankingPage() {
  const [section, setSection] = useState<BankSection>("accounts");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Bancos</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Button size="sm" variant={section === "accounts" ? "primary" : "secondary"} onClick={() => setSection("accounts")}>
          Cuentas bancarias
        </Button>
        <Button size="sm" variant={section === "transactions" ? "primary" : "secondary"} onClick={() => setSection("transactions")}>
          Movimientos
        </Button>
        <Button size="sm" variant={section === "reconciliations" ? "primary" : "secondary"} onClick={() => setSection("reconciliations")}>
          Conciliaciones
        </Button>
      </div>

      {section === "accounts" && <BankAccountsSection />}
      {section === "transactions" && <BankTransactionsSection />}
      {section === "reconciliations" && <ReconciliationsSection />}
    </AppLayout>
  );
}
