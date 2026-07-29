import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { listAuditLogs } from "../api/audit.api";

const ACTIONS = [
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_PRICE_CHANGED",
  "PRODUCT_COST_CHANGED",
  "PRODUCT_BARCODE_CHANGED",
  "PRODUCT_DELETED",
  "STOCK_ENTRY_REGISTERED",
  "STOCK_ADJUSTED",
  "SALE_COMPLETED",
  "SALE_CANCELLED",
  "RETURN_CREATED",
  "CREDIT_NOTE_ISSUED",
  "DEBIT_NOTE_ISSUED",
  "DISCOUNT_AUTHORIZED",
  "CASH_SESSION_OPENED",
  "CASH_SESSION_CLOSED",
  "CASH_MOVEMENT_REGISTERED",
  "PERMISSION_CHANGED",
  "ROLE_ASSIGNED",
  "ROLE_REMOVED",
  "USER_CREATED",
  "USER_UPDATED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "EMPLOYEE_CREATED",
  "EMPLOYEE_UPDATED",
  "EMPLOYEE_DEACTIVATED",
  "TIME_ENTRY_CLOCK_IN",
  "TIME_ENTRY_CLOCK_OUT",
  "VACATION_REQUESTED",
  "VACATION_APPROVED",
  "VACATION_REJECTED",
  "LEAVE_PERMISSION_REQUESTED",
  "LEAVE_PERMISSION_APPROVED",
  "LEAVE_PERMISSION_REJECTED",
  "ABSENCE_REGISTERED",
  "SICK_LEAVE_SUBMITTED",
  "SICK_LEAVE_APPROVED",
  "SICK_LEAVE_REJECTED",
  "PAYROLL_PARAMETER_CREATED",
  "PAYROLL_CREATED",
  "PAYROLL_CALCULATED",
  "PAYROLL_APPROVED",
  "PAYROLL_PAID",
];

const PAGE_SIZE = 50;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });
}

export function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [entityId, setEntityId] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", entityType, action, entityId, page],
    queryFn: () =>
      listAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        entityId: entityId || undefined,
        take: PAGE_SIZE,
        skip: page * PAGE_SIZE,
      }),
  });

  function resetAndFilter(fn: () => void) {
    setPage(0);
    fn();
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Auditoria</h1>

      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Input
            label="Tipo de entidad"
            placeholder="Sale, Product, Employee..."
            value={entityType}
            onChange={(e) => resetAndFilter(() => setEntityType(e.target.value))}
          />
          <Input
            label="ID de entidad"
            value={entityId}
            onChange={(e) => resetAndFilter(() => setEntityId(e.target.value))}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Accion</span>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={action}
              onChange={(e) => resetAndFilter(() => setAction(e.target.value))}
            >
              <option value="">Todas</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Fecha</th>
              <th>Accion</th>
              <th>Entidad</th>
              <th>Descripcion</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((log) => (
              <Fragment key={log.id}>
                <tr className="border-b border-gray-100">
                  <td className="py-2 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{log.action}</td>
                  <td className="whitespace-nowrap">
                    {log.entityType} <span className="text-gray-400">{log.entityId.slice(0, 8)}</span>
                  </td>
                  <td>{log.description}</td>
                  <td className="text-right">
                    {log.metadata && (
                      <Button
                        variant="secondary"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        {expandedId === log.id ? "Ocultar" : "Detalle"}
                      </Button>
                    )}
                  </td>
                </tr>
                {expandedId === log.id && log.metadata && (
                  <tr>
                    <td colSpan={5} className="bg-gray-50 px-2 py-2">
                      <pre className="overflow-x-auto text-xs text-gray-600">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">Sin registros.</p>}

        <div className="mt-3 flex items-center justify-between">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Anterior
          </Button>
          <span className="text-xs text-gray-500">Pagina {page + 1}</span>
          <Button
            variant="secondary"
            disabled={(data?.data.length ?? 0) < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </Card>
    </AppLayout>
  );
}
