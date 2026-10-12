import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { listCashSessions } from "../api/cash.api";

const dateTime = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

/** Ultimos turnos de la caja: quien abrio y cerro, esperado, contado y diferencia. */
export function CashSessionHistory({ cashRegisterId }: { cashRegisterId: string }) {
  const { data } = useQuery({ queryKey: ["cash-sessions", cashRegisterId], queryFn: () => listCashSessions(cashRegisterId) });
  const sessions = data?.data ?? [];
  if (sessions.length === 0) return null;

  return (
    <Card title="Turnos de esta caja" noPadding className="mt-6">
      <Table>
        <TableHead>
          <tr>
            <Th>Abrio</Th>
            <Th>Cerro</Th>
            <Th className="text-right">Base</Th>
            <Th className="text-right">Esperado</Th>
            <Th className="text-right">Contado</Th>
            <Th className="text-right">Diferencia</Th>
          </tr>
        </TableHead>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id}>
              <Td>
                <span className="block font-medium text-slate-900">{s.openedByName ?? "-"}</span>
                <span className="text-xs text-slate-500">{dateTime(s.openedAt)}</span>
              </Td>
              <Td>
                {s.status === "OPEN" ? (
                  <Badge tone="success">Abierta</Badge>
                ) : (
                  <>
                    <span className="block text-slate-900">{s.closedByName ?? "-"}</span>
                    <span className="text-xs text-slate-500">{s.closedAt ? dateTime(s.closedAt) : ""}</span>
                  </>
                )}
              </Td>
              <Td className="text-right">{formatCOP(s.openingAmount)}</Td>
              <Td className="text-right">{s.closingAmountExpected != null ? formatCOP(s.closingAmountExpected) : "-"}</Td>
              <Td className="text-right">{s.closingAmountCounted != null ? formatCOP(s.closingAmountCounted) : "-"}</Td>
              <Td
                className={`text-right font-medium ${
                  !s.difference ? "text-slate-500" : s.difference > 0 ? "text-warning-700" : "text-danger-600"
                }`}
              >
                {s.status === "OPEN" ? "-" : s.difference ? `${s.difference > 0 ? "+" : "-"}${formatCOP(Math.abs(s.difference))}` : "Sin diferencia"}
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
