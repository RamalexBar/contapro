import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportChartOfAccountsResult } from "@erp/shared-types";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import type { ParsedSheet } from "../../../lib/spreadsheet";
import { importChartOfAccounts } from "../api/accounting.api";
import {
  CHART_FIELDS,
  buildChartRows,
  detectChartMapping,
  downloadChartTemplate,
  readChartSpreadsheet,
  type ChartColumnMapping,
  type ChartField,
} from "../lib/chart-of-accounts-import";

/**
 * Carga el plan de cuentas propio de la empresa (catalogo NIIF o PUC extendido de otro programa)
 * sobre el PUC precargado. Mismo flujo que la importacion de productos: elegir archivo -> revisar
 * columnas -> "Revisar archivo" (dryRun) -> "Importar". Todo o nada a nivel de validacion.
 */
export function ChartOfAccountsImportCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ChartColumnMapping | null>(null);
  const [readError, setReadError] = useState("");
  const [preview, setPreview] = useState<ImportChartOfAccountsResult | null>(null);
  const [done, setDone] = useState<ImportChartOfAccountsResult | null>(null);

  function reset() {
    setFileName("");
    setSheet(null);
    setMapping(null);
    setPreview(null);
    setReadError("");
  }

  async function onFile(file: File | undefined) {
    reset();
    setDone(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = await readChartSpreadsheet(file);
      if (parsed.rows.length === 0) throw new Error("El archivo no tiene cuentas debajo del encabezado");
      setSheet(parsed);
      setMapping(detectChartMapping(parsed.headers));
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    }
  }

  const missingRequired = mapping ? CHART_FIELDS.filter((f) => mapping[f.field] < 0) : [];

  const importMutation = useMutation({
    mutationFn: (dryRun: boolean) => importChartOfAccounts({ ...buildChartRows(sheet!, mapping!), dryRun }),
    onSuccess: (result, dryRun) => {
      if (dryRun) {
        setPreview(result);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      if (result.errors.length === 0) {
        setDone(result);
        reset();
      } else {
        setPreview(result);
      }
    },
  });

  function changeMapping(field: ChartField, column: number) {
    setMapping((prev) => (prev ? { ...prev, [field]: column } : prev));
    setPreview(null);
  }

  const doneAlert = done && (
    <Alert tone="success" className="mt-3">
      Plan de cuentas importado: {done.created} cuentas nuevas, {done.activated} activadas, {done.renamed} renombradas
      {done.skipped.length > 0 && ` y ${done.skipped.length} de orden omitidas`}.
    </Alert>
  );

  if (!open) {
    return (
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 shrink-0 text-brand-600" size={20} />
            <div>
              <p className="text-sm font-medium text-slate-900">Importar tu plan de cuentas desde Excel</p>
              <p className="text-sm text-slate-500">
                Trae el catalogo de tu contador (NIIF o PUC con tus subcuentas) en vez de crear las cuentas una por una.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Upload size={16} className="mr-1.5 inline" />
            Importar
          </Button>
        </div>
        {doneAlert}
      </Card>
    );
  }

  const plannedChanges = preview ? preview.created + preview.activated + preview.renamed : 0;

  return (
    <Card
      title="Importar plan de cuentas desde Excel"
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Usa la{" "}
            <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => void downloadChartTemplate()}>
              <Download size={14} className="mr-0.5 inline" />
              plantilla
            </button>{" "}
            o el catalogo exportado de tu programa contable: solo se necesitan las columnas de codigo y nombre.
          </li>
          <li>
            Las cuentas que ya estan en Contapro se activan; las nuevas se crean debajo de su cuenta padre segun el codigo
            (110505 queda dentro de 1105). Las cuentas que no esten en el archivo no se tocan.
          </li>
          <li>Pulsa "Revisar archivo": no se guarda nada hasta que no haya errores.</li>
        </ol>

        {doneAlert}

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />

        {readError && <Alert tone="danger">{readError}</Alert>}

        {sheet && mapping && (
          <>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{fileName}</span>: {sheet.rows.length} filas con datos (encabezado en la fila{" "}
              {sheet.headerRowNumber}).
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CHART_FIELDS.map((f) => (
                <Select key={f.field} label={`${f.label} *`} value={mapping[f.field]} onChange={(e) => changeMapping(f.field, Number(e.target.value))}>
                  <option value={-1}>Elegir columna</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Columna ${i + 1}`}
                    </option>
                  ))}
                </Select>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <Alert tone="warning">Falta elegir la columna de: {missingRequired.map((f) => f.label).join(", ")}.</Alert>
            )}

            {importMutation.isError && <Alert tone="danger">{(importMutation.error as Error).message}</Alert>}

            {preview && preview.errors.length > 0 && (
              <div className="space-y-2">
                <Alert tone="danger">
                  {preview.errors.length === 1 ? "1 fila con errores. Corrigela" : `${preview.errors.length} filas con errores. Corrigelas`} en el
                  archivo y vuelve a subirlo; no se importo ninguna cuenta.
                </Alert>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHead>
                      <tr>
                        <Th>Fila</Th>
                        <Th>Problema</Th>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {preview.errors.map((e) => (
                        <TableRow key={e.rowNumber}>
                          <Td className="font-medium text-slate-900">{e.rowNumber}</Td>
                          <Td>{e.messages.join(" · ")}</Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {preview && preview.errors.length === 0 && (
              <Alert tone="success">
                Todo en orden: {preview.created} cuentas nuevas, {preview.activated} se activan, {preview.renamed} se renombran y{" "}
                {preview.unchanged} ya estaban igual.
              </Alert>
            )}

            {preview && preview.skipped.length > 0 && (
              <Alert tone="info">
                {preview.skipped.length === 1 ? "Se omite 1 cuenta de orden" : `Se omiten ${preview.skipped.length} cuentas de orden`} (clases 8 y
                9): Contapro todavia no las maneja.
              </Alert>
            )}

            {preview && preview.principalNamesKept.length > 0 && (
              <details className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium text-slate-900">
                  {preview.principalNamesKept.length} cuentas principales conservan su nombre PUC
                </summary>
                <p className="mt-2">
                  Las clases, grupos y cuentas de 4 digitos son fijas en Contapro. Se usan con tu codigo, pero mantienen el nombre del PUC:
                </p>
                <ul className="mt-2 space-y-1">
                  {preview.principalNamesKept.map((p) => (
                    <li key={p.code}>
                      <span className="font-medium text-slate-900">{p.code}</span> {p.currentName}{" "}
                      <span className="text-slate-400">(en tu archivo: {p.fileName})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={missingRequired.length > 0}
                loading={importMutation.isPending && importMutation.variables === true}
                onClick={() => importMutation.mutate(true)}
              >
                Revisar archivo
              </Button>
              <Button
                disabled={!preview || preview.errors.length > 0 || plannedChanges === 0}
                loading={importMutation.isPending && importMutation.variables === false}
                onClick={() => importMutation.mutate(false)}
              >
                Importar {preview && preview.errors.length === 0 && plannedChanges > 0 ? `(${plannedChanges} cambios)` : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
