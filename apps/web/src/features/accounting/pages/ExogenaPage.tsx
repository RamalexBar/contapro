import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
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
  return (
    <Badge tone="warning" >
      incompleto
    </Badge>
  );
}

export function ExogenaPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [format, setFormat] = useState<ExogenaFormatCode>("1001");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Toda la pagina (los 5 formatos) solo exige accounting.read en el backend (ver
  // exogena.routes.ts) -- no hay ninguna accion de escritura aqui, asi que un solo gate a nivel
  // de pagina alcanza (mismo criterio que ReportsSection en AccountingPage.tsx, que tampoco muta
  // nada). Antes esta pagina no revisaba ningun permiso en el frontend.
  const canRead = useAuthStore((s) => s.hasPermission("accounting.read"));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exogena", format, year],
    queryFn: () => getExogenaReport(format, year),
    enabled: canRead,
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

  if (!canRead) {
    return (
      <AppLayout>
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Información exógena DIAN</h1>
        <Alert tone="warning">Tu usuario no tiene permiso para ver esta seccion.</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Información exógena DIAN</h1>
      <p className="mb-4 text-sm text-slate-500">
        Formatos 1001/1003/1007/1008/1009 generados a partir de compras, ventas, retenciones y
        saldos ya registrados. Layout de columnas best-effort, no validado contra el prevalidador
        oficial de la DIAN — revisar antes de un envío real (ver <code>modules/exogena/README.md</code>).
        Los terceros marcados <Badge tone="warning">incompleto</Badge> no tienen código DANE de municipio asignado.
      </p>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Button key={f.code} size="sm" variant={format === f.code ? "primary" : "secondary"} onClick={() => setFormat(f.code)}>
                {f.code}
              </Button>
            ))}
          </div>
          {(format === "1001" || format === "1003" || format === "1007") && (
            <Input
              type="number"
              className="w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          )}
          <Button variant="secondary" loading={downloading} onClick={handleDownload}>
            {downloading ? "Generando..." : "Descargar archivo plano"}
          </Button>
        </div>
        <p className="text-sm text-slate-600">{FORMATS.find((f) => f.code === format)?.label}</p>
        {downloadError && (
          <Alert tone="danger" className="mt-2">
            {downloadError}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading && <Spinner />}
        {isError && (
          <div className="p-4">
            <Alert tone="danger">{(error as Error).message}</Alert>
          </div>
        )}
        {!isLoading && !isError && data?.data.length === 0 && <EmptyState title="Sin datos para este formato/año" />}
        {!isLoading && !isError && data && data.data.length > 0 && (
          <Table>
            <TableHead>
              <tr>
                <Th>Documento</Th>
                <Th>Nombre</Th>
                {format === "1001" && (
                  <>
                    <Th>Concepto pago</Th>
                    <Th>Valor pago</Th>
                    <Th>Retención practicada</Th>
                  </>
                )}
                {format === "1003" && (
                  <>
                    <Th>Concepto retención</Th>
                    <Th>Base</Th>
                    <Th>Retención</Th>
                  </>
                )}
                {format === "1007" && <Th>Ingreso</Th>}
                {(format === "1008" || format === "1009") && <Th>Saldo</Th>}
              </tr>
            </TableHead>
            <TableBody>
              {format === "1001" &&
                (data?.data as Format1001Row[])?.map((r) => (
                  <TableRow key={r.supplierId}>
                    <Td>
                      {r.documentType} {r.documentNumber}
                    </Td>
                    <Td className="space-x-1">
                      <span>{r.name}</span>
                      <IncompleteBadge incompleto={r.incompleto} />
                    </Td>
                    <Td>{r.conceptoPago}</Td>
                    <Td>{formatCOP(r.valorPago)}</Td>
                    <Td>{formatCOP(r.valorRetencionPracticada)}</Td>
                  </TableRow>
                ))}
              {format === "1003" &&
                (data?.data as Format1003Row[])?.map((r, i) => (
                  <TableRow key={`${r.supplierId}-${i}`}>
                    <Td>
                      {r.documentType} {r.documentNumber}
                    </Td>
                    <Td className="space-x-1">
                      <span>{r.name}</span>
                      <IncompleteBadge incompleto={r.incompleto} />
                    </Td>
                    <Td className="space-x-1">
                      <span>{r.conceptoRetencion ?? "-"}</span>
                      <IncompleteBadge incompleto={r.conceptoIncompleto} />
                    </Td>
                    <Td>{formatCOP(r.valorBase)}</Td>
                    <Td>{formatCOP(r.valorRetencion)}</Td>
                  </TableRow>
                ))}
              {format === "1007" &&
                (data?.data as Format1007Row[])?.map((r) => (
                  <TableRow key={r.customerId}>
                    <Td>
                      {r.documentType} {r.documentNumber}
                    </Td>
                    <Td className="space-x-1">
                      <span>{r.name}</span>
                      <IncompleteBadge incompleto={r.incompleto} />
                    </Td>
                    <Td>{formatCOP(r.valorIngreso)}</Td>
                  </TableRow>
                ))}
              {format === "1008" &&
                (data?.data as Format1008Row[])?.map((r) => (
                  <TableRow key={r.customerId}>
                    <Td>
                      {r.documentType} {r.documentNumber}
                    </Td>
                    <Td className="space-x-1">
                      <span>{r.name}</span>
                      <IncompleteBadge incompleto={r.incompleto} />
                    </Td>
                    <Td>{formatCOP(r.saldo)}</Td>
                  </TableRow>
                ))}
              {format === "1009" &&
                (data?.data as Format1009Row[])?.map((r) => (
                  <TableRow key={r.supplierId}>
                    <Td>
                      {r.documentType} {r.documentNumber}
                    </Td>
                    <Td className="space-x-1">
                      <span>{r.name}</span>
                      <IncompleteBadge incompleto={r.incompleto} />
                    </Td>
                    <Td>{formatCOP(r.saldo)}</Td>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
