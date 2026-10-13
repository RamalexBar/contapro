import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import type { ApproveTimeOffInput } from "../api/time-off.api";

export type DecisionMode = "approve" | "reject";

interface DecidableRecord {
  startDate: string;
  endDate: string;
  daysTaken?: number;
  decisionNote: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  status: string;
}

const day = (iso: string) => iso.slice(0, 10);

/** Debajo del periodo: fechas que pidio el empleado (si se aprobo con otras) y la nota/motivo. */
export function DecisionInfo({ record }: { record: DecidableRecord }) {
  if (!record.requestedStartDate && !record.decisionNote) return null;
  return (
    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
      {record.requestedStartDate && record.requestedEndDate && (
        <p>
          Pedidas: {day(record.requestedStartDate)} a {day(record.requestedEndDate)}
        </p>
      )}
      {record.decisionNote && (
        <p>
          {record.status === "REJECTED" ? "Motivo" : "Nota"}: {record.decisionNote}
        </p>
      )}
    </div>
  );
}

/**
 * Panel de decision en una fila completa debajo de la solicitud: aprobar tal cual o con otras
 * fechas (y dias, en vacaciones) y una nota; rechazar exige el motivo, que el empleado ve.
 */
export function DecisionPanel({
  mode,
  record,
  withDays,
  pending,
  error,
  onCancel,
  onApprove,
  onReject,
}: {
  mode: DecisionMode;
  record: DecidableRecord;
  withDays: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onApprove: (input: ApproveTimeOffInput) => void;
  onReject: (reason: string) => void;
}) {
  const [startDate, setStartDate] = useState(day(record.startDate));
  const [endDate, setEndDate] = useState(day(record.endDate));
  const [daysTaken, setDaysTaken] = useState(record.daysTaken ? String(record.daysTaken) : "");
  const [note, setNote] = useState("");

  const datesChanged = startDate !== day(record.startDate) || endDate !== day(record.endDate);
  const invalidDates = endDate < startDate;

  if (mode === "reject") {
    return (
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <Input
          label="Motivo del rechazo (el empleado lo va a ver)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: esa semana hay inventario"
          autoFocus
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex gap-2">
          <Button size="sm" variant="danger" disabled={note.trim().length < 3} loading={pending} onClick={() => onReject(note.trim())}>
            Rechazar
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-sm text-slate-600">Aprueba con las fechas pedidas o cambialas; el empleado vera las dos.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Desde" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="Hasta" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        {withDays && <Input label="Dias" type="number" min={1} value={daysTaken} onChange={(e) => setDaysTaken(e.target.value)} />}
        <div className="min-w-[14rem] flex-1">
          <Input label="Nota para el empleado (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {invalidDates && <Alert tone="warning">La fecha final no puede ser anterior a la inicial.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={invalidDates || (withDays && !(Number(daysTaken) > 0))}
          loading={pending}
          onClick={() =>
            onApprove({
              ...(datesChanged ? { startDate, endDate } : {}),
              ...(withDays && datesChanged ? { daysTaken: Number(daysTaken) } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            })
          }
        >
          {datesChanged ? "Aprobar con estas fechas" : "Aprobar"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
