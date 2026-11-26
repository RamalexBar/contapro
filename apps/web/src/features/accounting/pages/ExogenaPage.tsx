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
import { TaxCertificatesCard } from "../components/TaxCertificatesCard";
import { downloadExogenaFlatFile, getExogenaReport, NEEDS_YEAR, type ExogenaFormatCode, type ExogenaRow } from "../api/exogena.api";

const FORMATS: { code: ExogenaFormatCode; label: string }[] = [
  { code: "1001", label: "1001 · Pagos a proveedores (por concepto DIAN)" },
  { code: "1003", label: "1003 · Retenciones practicadas" },
  { code: "1005", label: "1005 · IVA descontable" },
  { code: "1006", label: "1006 · IVA generado" },
  { code: "1007", label: "1007 · Ingresos (ventas)" },
  { code: "1008", label: "1008 · Saldos por cobrar" },
  { code: "1009", label: "1009 · Saldos por pagar" },
  { code: "2276", label: "2276 · Rentas de trabajo (empleados)" },
];

type Column = { header: string; value: (r: ExogenaRow) => string | number | boolean | null | undefined; money?: boolean };

/** Columnas de cada formato (ademas de documento y nombre). */
const COLUMNS: Record<ExogenaFormatCode, Column[]> = {
  "1001": [
    { header: "Concepto", value: (r) => r.conceptoPago },
    { header: "Pago (sin IVA)", value: (r) => r.pagoDeducible, money: true },
    { header: "Ret. renta", value: (r) => r.retencionRentaPracticada, money: true },
    { header: "Ret. IVA", value: (r) => r.retencionIvaResponsables, money: true },
  ],
  "1003": [
    { header: "Concepto retención", value: (r) => r.conceptoRetencion ?? "-" },
    { header: "Base", value: (r) => r.valorBase, money: true },
    { header: "Retención", value: (r) => r.valorRetencion, money: true },
  ],
  "1005": [
    { header: "IVA descontable", value: (r) => r.ivaDescontable, money: true },
    { header: "IVA devoluciones en ventas", value: (r) => r.ivaDevolucionesVentas, money: true },
  ],
  "1006": [
    { header: "IVA generado", value: (r) => r.ivaGenerado, money: true },
    { header: "Impuesto al consumo", value: (r) => r.impuestoConsumo, money: true },
  ],
  "1007": [
    { header: "Concepto", value: (r) => r.conceptoIngreso },
    { header: "Ingresos", value: (r) => r.valorIngreso, money: true },
    { header: "Devoluciones y descuentos", value: (r) => r.devolucionesRebajasDescuentos, money: true },
  ],
  "1008": [{ header: "Saldo", value: (r) => r.saldo, money: true }],
  "1009": [{ header: "Saldo", value: (r) => r.saldo, money: true }],
  "2276": [
    { header: "Salarios", value: (r) => r.pagosSalarios, money: true },
    { header: "Prestaciones", value: (r) => r.pagosPrestacionesSociales, money: true },
    { header: "Otros pagos", value: (r) => r.otrosPagos, money: true },
    { header: "Cesantías e int. pagados", value: (r) => r.cesantiasInteresesPagados, money: true },
    { header: "Cesantías al fondo", value: (r) => r.cesantiasConsignadasFondo, money: true },
    { header: "Salud", value: (r) => r.aportesSalud, money: true },
    { header: "Pensión y FSP", value: (r) => r.aportesPensionFsp, money: true },
    { header: "Retención", value: (r) => r.retencionFuente, money: true },
  ],
};

function rowName(r: ExogenaRow): string {
  if (r.name) return r.name;
  return [r.firstName, r.otherNames, r.firstSurname, r.secondSurname].filter(Boolean).join(" ");
}

export function ExogenaPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [format, setFormat] = useState<ExogenaFormatCode>("1001");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Toda la pagina solo exige accounting.read en el backend (exogena.routes.ts): no hay acciones de escritura.
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

  const columns = COLUMNS[format];
  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Información exógena DIAN</h1>
      <p className="mb-4 text-sm text-slate-500">
        Formatos generados a partir de compras, ventas, facturas, devoluciones, retenciones, nómina y saldos ya registrados
        (Resolución DIAN 000227 de 2025). Las ventas a consumidor final van en un solo registro 222222222 «CUANTÍAS
        MENORES», tipo de documento 43. El orden de columnas del archivo plano no está validado contra el prevalidador
        oficial: revisar antes de un envío real. Los terceros marcados <Badge tone="warning">incompleto</Badge> no tienen
        código DANE de municipio.
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
          {NEEDS_YEAR[format] && <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />}
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
                {columns.map((c) => (
                  <Th key={c.header}>{c.header}</Th>
                ))}
              </tr>
            </TableHead>
            <TableBody>
              {data.data.map((r, i) => (
                <TableRow key={i}>
                  <Td>
                    {r.documentType} {r.documentNumber}
                  </Td>
                  <Td className="space-x-1">
                    <span>{rowName(r)}</span>
                    {r.incompleto && <Badge tone="warning">incompleto</Badge>}
                    {r.conceptoIncompleto && <Badge tone="warning">concepto sin asignar</Badge>}
                  </Td>
                  {columns.map((c) => {
                    const v = c.value(r);
                    return <Td key={c.header}>{c.money ? formatCOP(Number(v ?? 0)) : String(v ?? "-")}</Td>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <TaxCertificatesCard />
    </AppLayout>
  );
}
