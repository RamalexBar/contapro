import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listAccounts, listEntries } from "../api/accounting.api";

const ENTRY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Confirmado",
  VOID: "Anulado",
};

function entryStatusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "POSTED") return "success";
  if (status === "VOID") return "danger";
  return "neutral";
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return formatLocalDate(new Date());
}

function monthStartStr(): string {
  const d = new Date();
  return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Vista de solo lectura del Libro Diario -- a diferencia de la pestana "Comprobantes" de
 * Contabilidad (pensada para crear/confirmar/anular), esta es para que cualquiera con permiso de
 * lectura revise rapido, dia a dia, como quedaron asentados los movimientos, con el detalle de
 * cuentas debitadas/acreditadas de una vez (sin tener que abrir el PDF de cada comprobante). */
export function JournalBookPage() {
  const canRead = useAuthStore((s) => s.hasPermission("accounting.read"));
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState<"ALL" | "POSTED" | "DRAFT" | "VOID">("POSTED");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["accounting", "entries", "journal-book"],
    queryFn: () => listEntries(),
    enabled: canRead,
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounting", "accounts"],
    queryFn: listAccounts,
    enabled: canRead,
  });

  const accountLabel = useMemo(() => {
    const byId = new Map((accounts?.data ?? []).map((a) => [a.id, a]));
    return (accountId: string) => {
      const a = byId.get(accountId);
      return a ? `${a.code} ${a.name}` : accountId;
    };
  }, [accounts]);

  const filtered = useMemo(() => {
    return (entries?.data ?? [])
      .filter((e) => e.date.slice(0, 10) >= from && e.date.slice(0, 10) <= to)
      .filter((e) => status === "ALL" || e.status === status)
      .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
  }, [entries, from, to, status]);

  if (!canRead) {
    return (
      <AppLayout>
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Libro Diario</h1>
        <Alert tone="warning">Tu usuario no tiene permiso para ver esta seccion.</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Libro Diario</h1>
      <p className="mb-4 text-sm text-slate-500">
        Todos los comprobantes contables en orden cronologico, con el detalle de cuentas debitadas y acreditadas.
      </p>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="ALL">Todos</option>
            <option value="POSTED">Confirmados</option>
            <option value="DRAFT">Borradores</option>
            <option value="VOID">Anulados</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">No hay comprobantes en ese rango de fechas.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
            const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
            return (
              <Card key={entry.id} noPadding>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">#{entry.number}</span>
                    <span className="text-sm text-slate-500">{entry.date.slice(0, 10)}</span>
                    <span className="text-sm text-slate-700">{entry.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{formatCOP(totalDebit)}</span>
                    <Badge tone={entryStatusTone(entry.status)}>{ENTRY_STATUS_LABEL[entry.status] ?? entry.status}</Badge>
                  </div>
                </button>
                {isExpanded && (
                  <Table>
                    <TableHead>
                      <tr>
                        <Th>Cuenta</Th>
                        <Th>Descripcion</Th>
                        <Th>Debito</Th>
                        <Th>Credito</Th>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {entry.lines.map((line) => (
                        <TableRow key={line.id}>
                          <Td>{accountLabel(line.accountId)}</Td>
                          <Td>{line.description ?? "-"}</Td>
                          <Td>{line.debit ? formatCOP(line.debit) : ""}</Td>
                          <Td>{line.credit ? formatCOP(line.credit) : ""}</Td>
                        </TableRow>
                      ))}
                      <TableRow className="hover:bg-transparent">
                        <Td className="font-medium text-slate-900" colSpan={2}>
                          Total
                        </Td>
                        <Td className="font-medium text-slate-900">{formatCOP(totalDebit)}</Td>
                        <Td className="font-medium text-slate-900">{formatCOP(totalCredit)}</Td>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
