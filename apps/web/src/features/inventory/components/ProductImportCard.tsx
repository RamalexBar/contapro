import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportProductsResult } from "@erp/shared-types";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { importProducts } from "../api/product.api";
import {
  IMPORT_FIELDS,
  buildImportRows,
  detectMapping,
  downloadTemplate,
  readProductSpreadsheet,
  type ColumnMapping,
  type ImportField,
  type ParsedSheet,
} from "../lib/product-import";

/**
 * Carga masiva de productos desde Excel/CSV (plantilla propia o exportacion de Alegra/Siigo).
 * Flujo: elegir archivo -> revisar columnas detectadas -> "Revisar archivo" (dryRun en la API, no
 * crea nada) -> si no hay errores, "Importar". La API rechaza el lote completo si alguna fila
 * tiene error, asi que nunca queda medio catalogo cargado.
 */
export function ProductImportCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [readError, setReadError] = useState("");
  const [preview, setPreview] = useState<ImportProductsResult | null>(null);
  const [done, setDone] = useState<ImportProductsResult | null>(null);

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
      const parsed = await readProductSpreadsheet(file);
      if (parsed.rows.length === 0) throw new Error("El archivo no tiene productos debajo del encabezado");
      setSheet(parsed);
      setMapping(detectMapping(parsed.headers));
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    }
  }

  const missingRequired = mapping ? IMPORT_FIELDS.filter((f) => f.required && mapping[f.field] < 0) : [];

  const importMutation = useMutation({
    mutationFn: (dryRun: boolean) => {
      const built = buildImportRows(sheet!, mapping!);
      return importProducts({ ...built, pricesIncludeTax, dryRun });
    },
    onSuccess: (result, dryRun) => {
      if (dryRun) {
        setPreview(result);
        return;
      }
      if (result.created > 0) {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      }
      if (result.errors.length === 0) {
        setDone(result);
        reset();
      } else {
        setPreview(result);
      }
    },
  });

  function changeMapping(field: ImportField, column: number) {
    setMapping((prev) => (prev ? { ...prev, [field]: column } : prev));
    setPreview(null);
  }

  const doneAlert = done && (
    <Alert tone="success" className="mt-3">
      Se importaron {done.created} productos
      {done.categoriesCreated.length > 0 && ` y se crearon las categorias ${done.categoriesCreated.join(", ")}`}.
    </Alert>
  );

  if (!open) {
    return (
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 shrink-0 text-brand-600" size={20} />
            <div>
              <p className="text-sm font-medium text-slate-900">Importar productos desde Excel</p>
              <p className="text-sm text-slate-500">Carga todo tu catalogo de una vez: plantilla de Contapro o exportacion de Alegra/Siigo.</p>
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

  return (
    <Card
      title="Importar productos desde Excel"
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
            <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => void downloadTemplate()}>
              <Download size={14} className="mr-0.5 inline" />
              plantilla de Contapro
            </button>{" "}
            o el Excel que exportas desde Alegra, Siigo u otro sistema (.xlsx, .xls o .csv).
          </li>
          <li>Revisa que cada dato quede en la columna correcta.</li>
          <li>Pulsa "Revisar archivo": no se guarda nada hasta que no haya errores.</li>
        </ol>

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />

        {doneAlert}
        {readError && <Alert tone="danger">{readError}</Alert>}

        {sheet && mapping && (
          <>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{fileName}</span>: {sheet.rows.length} filas con datos (encabezado en la fila{" "}
              {sheet.headerRowNumber}).
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {IMPORT_FIELDS.map((f) => (
                <Select
                  key={f.field}
                  label={f.required ? `${f.label} *` : f.label}
                  value={mapping[f.field]}
                  onChange={(e) => changeMapping(f.field, Number(e.target.value))}
                >
                  <option value={-1}>{f.required ? "Elegir columna" : "No importar"}</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Columna ${i + 1}`}
                    </option>
                  ))}
                </Select>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={pricesIncludeTax}
                onChange={(e) => {
                  setPricesIncludeTax(e.target.checked);
                  setPreview(null);
                }}
              />
              Los precios del archivo ya incluyen IVA (Contapro guarda el precio antes de IVA)
            </label>

            <p className="text-xs text-slate-500">
              Sin columna de IVA se asume 19%. Sin referencia se genera una (PROD-0001...). El stock inicial se carga en tu sucursal activa.
            </p>

            {missingRequired.length > 0 && (
              <Alert tone="warning">Falta elegir la columna de: {missingRequired.map((f) => f.label).join(", ")}.</Alert>
            )}

            {importMutation.isError && <Alert tone="danger">{(importMutation.error as Error).message}</Alert>}

            {preview && preview.errors.length > 0 && (
              <div className="space-y-2">
                <Alert tone="danger">
                  {preview.errors.length === 1 ? "1 fila con errores. Corrigela" : `${preview.errors.length} filas con errores. Corrigelas`} en el archivo y vuelve a subirlo; no se importo ningun producto
                  {preview.created > 0 ? ` (salvo ${preview.created} que si se crearon)` : ""}.
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
                Todo en orden: {preview.validRows} productos listos para importar
                {preview.categoriesCreated.length > 0 && `. Se crearan las categorias: ${preview.categoriesCreated.join(", ")}`}.
              </Alert>
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
                disabled={!preview || preview.errors.length > 0 || preview.validRows === 0}
                loading={importMutation.isPending && importMutation.variables === false}
                onClick={() => importMutation.mutate(false)}
              >
                Importar {preview && preview.errors.length === 0 ? `${preview.validRows} productos` : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
