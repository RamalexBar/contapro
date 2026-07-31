import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  closeBankReconciliation,
  createBankAccount,
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
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva cuenta bancaria</h2>
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
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.accountType}
            onChange={(e) => setForm({ ...form, accountType: e.target.value })}
          >
            <option value="AHORROS">Ahorros</option>
            <option value="CORRIENTE">Corriente</option>
          </select>
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Banco</th>
              <th>Numero</th>
              <th>Tipo</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2">{a.bankName}</td>
                <td>{a.accountNumber}</td>
                <td>{a.accountType}</td>
                <td>{formatCOP(a.currentBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay cuentas bancarias registradas.</p>}
      </Card>
    </>
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
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Movimientos bancarios</h2>
        <select
          className="mb-4 rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
        >
          <option value="">Seleccionar cuenta bancaria...</option>
          {accounts?.data.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bankName} {a.accountNumber}
            </option>
          ))}
        </select>

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
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "DEBIT" | "CREDIT" })}
            >
              <option value="CREDIT">Credito (entrada)</option>
              <option value="DEBIT">Debito (salida)</option>
            </select>
            <Button type="submit" disabled={createMutation.isPending}>
              Registrar
            </Button>
          </form>
        )}
      </Card>

      {bankAccountId && (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Fecha</th>
                <th>Descripcion</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Conciliado</th>
                <th>Id</th>
              </tr>
            </thead>
            <tbody>
              {transactions?.data.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-2">{t.date.slice(0, 10)}</td>
                  <td>{t.description}</td>
                  <td>{t.type}</td>
                  <td>{formatCOP(t.amount)}</td>
                  <td>{t.reconciled ? "Si" : "No"}</td>
                  <td className="font-mono text-xs text-gray-400">{t.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions?.data.length === 0 && <p className="py-4 text-sm text-gray-400">Sin movimientos.</p>}
        </Card>
      )}
    </>
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
    mutationFn: (id: string) =>
      matchBankReconciliationItem(id, {
        bankTransactionId: matchForm.bankTransactionId || undefined,
        journalEntryLineId: matchForm.journalEntryLineId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking", "reconciliations"] });
      setMatchForm({ bankTransactionId: "", journalEntryLineId: "" });
    },
  });
  const closeMutation = useMutation({
    mutationFn: closeBankReconciliation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banking", "reconciliations"] }),
  });

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Iniciar conciliacion</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            startMutation.mutate();
          }}
        >
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.bankAccountId}
            onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
            required
          >
            <option value="">Cuenta bancaria...</option>
            {accounts?.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} {a.accountNumber}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={startMutation.isPending}>
            Iniciar
          </Button>
        </form>
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Periodo</th>
              <th>Extracto</th>
              <th>Libros</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reconciliations?.data.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-b border-gray-100">
                  <td className="py-2">
                    {r.periodStart.slice(0, 10)} - {r.periodEnd.slice(0, 10)}
                  </td>
                  <td>{formatCOP(r.statementBalance)}</td>
                  <td>{formatCOP(r.bookBalance)}</td>
                  <td>{formatCOP(r.statementBalance - r.bookBalance)}</td>
                  <td>{r.status}</td>
                  <td className="text-right">
                    <Button variant="secondary" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      {expandedId === r.id ? "Ocultar" : "Ver"}
                    </Button>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr>
                    <td colSpan={6} className="bg-gray-50 p-4">
                      <p className="mb-2 text-xs font-semibold text-gray-500">Items conciliados</p>
                      {r.items.map((item) => (
                        <p key={item.id} className="text-xs text-gray-600">
                          BankTransaction: {item.bankTransactionId ?? "-"} / JournalEntryLine: {item.journalEntryLineId ?? "-"}
                        </p>
                      ))}
                      {r.items.length === 0 && <p className="text-xs text-gray-400">Sin items todavia.</p>}

                      {r.status === "IN_PROGRESS" && (
                        <div className="mt-3 flex flex-wrap items-end gap-2">
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
                          <Button onClick={() => matchMutation.mutate(r.id)} disabled={matchMutation.isPending}>
                            Emparejar
                          </Button>
                          <Button variant="danger" onClick={() => closeMutation.mutate(r.id)} disabled={closeMutation.isPending}>
                            Cerrar conciliacion
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

type BankSection = "accounts" | "transactions" | "reconciliations";

export function BankingPage() {
  const [section, setSection] = useState<BankSection>("accounts");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Bancos</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "accounts" ? "primary" : "secondary"} onClick={() => setSection("accounts")}>
          Cuentas bancarias
        </Button>
        <Button variant={section === "transactions" ? "primary" : "secondary"} onClick={() => setSection("transactions")}>
          Movimientos
        </Button>
        <Button variant={section === "reconciliations" ? "primary" : "secondary"} onClick={() => setSection("reconciliations")}>
          Conciliaciones
        </Button>
      </div>

      {section === "accounts" && <BankAccountsSection />}
      {section === "transactions" && <BankTransactionsSection />}
      {section === "reconciliations" && <ReconciliationsSection />}
    </AppLayout>
  );
}
