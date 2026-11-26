import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listIncomeCertificates, listWithholdingCertificates, openIncomeCertificate, openWithholdingCertificate } from "../api/exogena.api";

type Kind = "withholding" | "income";

/**
 * Certificados que la empresa entrega cada año: de retenciones a sus proveedores (art. 381 E.T.) y de
 * ingresos y retenciones a sus empleados (formulario 220, hasta el ultimo dia habil de marzo).
 */
export function TaxCertificatesCard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const canPayroll = useAuthStore((s) => s.hasPermission("payroll.read"));
  const [kind, setKind] = useState<Kind>("withholding");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const withholding = useQuery({
    queryKey: ["certificates", "withholding", year],
    queryFn: () => listWithholdingCertificates(year),
    enabled: kind === "withholding",
  });
  const income = useQuery({
    queryKey: ["certificates", "income", year],
    queryFn: () => listIncomeCertificates(year),
    enabled: kind === "income" && canPayroll,
  });
  const active = kind === "withholding" ? withholding : income;

  async function open(id: string) {
    setPdfError(null);
    setOpening(id);
    try {
      await (kind === "withholding" ? openWithholdingCertificate(id, year) : openIncomeCertificate(id, year));
    } catch (err) {
      setPdfError((err as Error).message);
    } finally {
      setOpening(null);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="mb-1 text-base font-semibold text-slate-900">Certificados tributarios</h2>
      <p className="mb-4 text-sm text-slate-500">
        Se arman con las retenciones de las compras y con la nómina aprobada del año. Los certificados de ingresos y
        retenciones de los empleados se entregan a más tardar el último día hábil de marzo del año siguiente.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={kind === "withholding" ? "primary" : "secondary"} onClick={() => setKind("withholding")}>
          Retenciones a proveedores
        </Button>
        {canPayroll && (
          <Button size="sm" variant={kind === "income" ? "primary" : "secondary"} onClick={() => setKind("income")}>
            Ingresos y retenciones de empleados (220)
          </Button>
        )}
        <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>
      {pdfError && (
        <Alert tone="danger" className="mb-3">
          {pdfError}
        </Alert>
      )}
      {active.isLoading && <Spinner />}
      {active.isError && <Alert tone="danger">{(active.error as Error).message}</Alert>}
      {kind === "withholding" &&
        withholding.data &&
        (withholding.data.data.length === 0 ? (
          <EmptyState title="No se practicaron retenciones a proveedores en este año" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Documento</Th>
                <Th>Proveedor</Th>
                <Th>Renta</Th>
                <Th>IVA</Th>
                <Th>ICA</Th>
                <Th>Total</Th>
                <Th />
              </tr>
            </TableHead>
            <TableBody>
              {withholding.data.data.map((c) => (
                <TableRow key={c.supplier.id}>
                  <Td>
                    {c.supplier.documentType} {c.supplier.documentNumber}
                  </Td>
                  <Td>{c.supplier.name}</Td>
                  <Td>{formatCOP(c.totals.RETEFUENTE)}</Td>
                  <Td>{formatCOP(c.totals.RETEIVA)}</Td>
                  <Td>{formatCOP(c.totals.RETEICA)}</Td>
                  <Td className="font-medium">{formatCOP(c.totals.total)}</Td>
                  <Td>
                    <Button size="sm" variant="secondary" loading={opening === c.supplier.id} onClick={() => open(c.supplier.id)}>
                      Ver PDF
                    </Button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
      {kind === "income" &&
        income.data &&
        (income.data.data.length === 0 ? (
          <EmptyState title="No hay nómina aprobada en este año" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Documento</Th>
                <Th>Empleado</Th>
                <Th>Ingresos brutos</Th>
                <Th>Retención</Th>
                <Th />
              </tr>
            </TableHead>
            <TableBody>
              {income.data.data.map((c) => (
                <TableRow key={c.employeeId}>
                  <Td>
                    {c.documentType} {c.documentNumber}
                  </Td>
                  <Td>{[c.firstName, c.otherNames, c.firstSurname, c.secondSurname].filter(Boolean).join(" ")}</Td>
                  <Td>{formatCOP(c.totalIngresosBrutos)}</Td>
                  <Td>{formatCOP(c.retencionFuente)}</Td>
                  <Td>
                    <Button size="sm" variant="secondary" loading={opening === c.employeeId} onClick={() => open(c.employeeId)}>
                      Ver PDF
                    </Button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </Card>
  );
}
