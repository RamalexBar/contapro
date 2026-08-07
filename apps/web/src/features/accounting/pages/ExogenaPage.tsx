import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  downloadExogenaFlatFile,
  getExogenaReport,
  type ExogenaFormatCode,
  type Format1001Row,
  type Format1003Row,
  type Format1007Row,
  type Format1008Row,
  type Format1009Row,
} from "../api/exogena.api";

const FORMATS: { code: ExogenaFormatCode; label: string }[] = [
  { code: "1001", label: "1001 · Pagos a proveedores" },
  { code: "1003", label: "1003 · Retenciones practicadas" },
  { code: "1007", label: "1007 · Ingresos (ventas)" },
  { code: "1008", label: "1008 · Saldos por cobrar" },
  { code: "1009", label: "1009 · Saldos por pagar" },
];

function IncompleteBadge({ incompleto }: { incompleto: boolean }) {
  if (!incompleto) return null;
  return <span className="ml-1 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">incompleto</span>;
}

export function ExogenaPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [format, setFormat] = useState<ExogenaFormatCode>("1001");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exogena", format, year],
    queryFn: () => getExogenaReport(format, year),
  });

  async function handleDownload() {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadExogenaFlatFile(format, year);
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Información exógena DIAN</h1>
      <p className="mb-4 text-sm text-gray-500">
        Formatos 1001/1003/1007/1008/1009 generados a partir de compras, ventas, retenciones y
        saldos ya registrados. Layout de columnas best-effort, no validado contra el prevalidador
        oficial de la DIAN — revisar antes de un envío real (ver <code>modules/exogena/README.md</code>).
        Los terceros marcados <span className="rounded bg-yellow-100 px-1 text-yellow-700">incompleto</span>{" "}
        no tienen código DANE de municipio asignado.
      </p>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <Button key={f.code} variant={format === f.code ? "primary" : "secondary"} onClick={() => setFormat(f.code)}>
                {f.code}
              </Button>
            ))}
          </div>
          {(format === "1001" || format === "1003" || format === "1007") && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Año:
              <input
                type="number"
                className="w-24 rounded border border-gray-300 px-2 py-1"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
          )}
          <Button variant="secondary" disabled={downloading} onClick={handleDownload}>
            {downloading ? "Generando..." : "Descargar archivo plano"}
          </Button>
        </div>
        <p className="text-sm text-gray-600">{FORMATS.find((f) => f.code === format)?.label}</p>
        {downloadError && <p className="mt-2 text-sm text-red-600">{downloadError}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        {isError && <p className="text-sm text-red-600">{(error as Error).message}</p>}
        {!isLoading && !isError && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Documento</th>
                <th>Nombre</th>
                {format === "1001" && (
                  <>
                    <th>Concepto pago</th>
                    <th>Valor pago</th>
                    <th>Retención practicada</th>
                  </>
                )}
                {format === "1003" && (
                  <>
                    <th>Concepto retención</th>
                    <th>Base</th>
                    <th>Retención</th>
                  </>
                )}
                {format === "1007" && <th>Ingreso</th>}
                {(format === "1008" || format === "1009") && <th>Saldo</th>}
              </tr>
            </thead>
            <tbody>
              {format === "1001" &&
                (data?.data as Format1001Row[])?.map((r) => (
                  <tr key={r.supplierId} className="border-b border-gray-100">
                    <td className="py-2">
                      {r.documentType} {r.documentNumber}
                    </td>
                    <td>
                      {r.name}
                      <IncompleteBadge incompleto={r.incompleto} />
                    </td>
                    <td>{r.conceptoPago}</td>
                    <td>{formatCOP(r.valorPago)}</td>
                    <td>{formatCOP(r.valorRetencionPracticada)}</td>
                  </tr>
                ))}
              {format === "1003" &&
                (data?.data as Format1003Row[])?.map((r, i) => (
                  <tr key={`${r.supplierId}-${i}`} className="border-b border-gray-100">
                    <td className="py-2">
                      {r.documentType} {r.documentNumber}
                    </td>
                    <td>
                      {r.name}
                      <IncompleteBadge incompleto={r.incompleto} />
                    </td>
                    <td>
                      {r.conceptoRetencion ?? "-"}
                      <IncompleteBadge incompleto={r.conceptoIncompleto} />
                    </td>
                    <td>{formatCOP(r.valorBase)}</td>
                    <td>{formatCOP(r.valorRetencion)}</td>
                  </tr>
                ))}
              {format === "1007" &&
                (data?.data as Format1007Row[])?.map((r) => (
                  <tr key={r.customerId} className="border-b border-gray-100">
                    <td className="py-2">
                      {r.documentType} {r.documentNumber}
                    </td>
                    <td>
                      {r.name}
                      <IncompleteBadge incompleto={r.incompleto} />
                    </td>
                    <td>{formatCOP(r.valorIngreso)}</td>
                  </tr>
                ))}
              {format === "1008" &&
                (data?.data as Format1008Row[])?.map((r) => (
                  <tr key={r.customerId} className="border-b border-gray-100">
                    <td className="py-2">
                      {r.documentType} {r.documentNumber}
                    </td>
                    <td>
                      {r.name}
                      <IncompleteBadge incompleto={r.incompleto} />
                    </td>
                    <td>{formatCOP(r.saldo)}</td>
                  </tr>
                ))}
              {format === "1009" &&
                (data?.data as Format1009Row[])?.map((r) => (
                  <tr key={r.supplierId} className="border-b border-gray-100">
                    <td className="py-2">
                      {r.documentType} {r.documentNumber}
                    </td>
                    <td>
                      {r.name}
                      <IncompleteBadge incompleto={r.incompleto} />
                    </td>
                    <td>{formatCOP(r.saldo)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {!isLoading && !isError && data?.data.length === 0 && (
          <p className="py-4 text-sm text-gray-400">Sin datos para este formato/año.</p>
        )}
      </Card>
    </AppLayout>
  );
}
