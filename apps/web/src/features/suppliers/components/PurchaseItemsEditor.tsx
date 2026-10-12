import { formatCOP, round2 } from "@erp/shared-utils";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import type { ExtractPurchaseInvoiceResult, PurchaseItemInput } from "../api/supplier.api";
import { ProductPicker, type PickedProduct } from "./ProductPicker";

/** Renglon de la compra en edicion (todo como texto, igual que el resto del formulario). */
export interface PurchaseLine {
  key: string;
  /** Lo que dice la factura, solo para mostrar -- vacio en un renglon agregado a mano. */
  invoiceDescription: string;
  invoiceCode: string;
  mode: "existing" | "new";
  product: PickedProduct | null;
  newName: string;
  newSalePrice: string;
  newTaxRate: string;
  newBarcode: string;
  quantity: string;
  unitCost: string;
}

let keySequence = 0;
const nextKey = () => `line-${++keySequence}`;

export function emptyLine(): PurchaseLine {
  return {
    key: nextKey(),
    invoiceDescription: "",
    invoiceCode: "",
    mode: "existing",
    product: null,
    newName: "",
    newSalePrice: "",
    newTaxRate: "19",
    newBarcode: "",
    quantity: "1",
    unitCost: "",
  };
}

/** Renglones leidos de la foto: el producto sugerido si lo hay; si no, "producto nuevo" con el nombre de la factura. */
export function linesFromExtraction(result: ExtractPurchaseInvoiceResult): PurchaseLine[] {
  return result.lines.map((line) => {
    const quantity = line.quantity && line.quantity > 0 ? line.quantity : 1;
    const unitCost = line.unitPrice ?? (line.lineTotal != null ? round2(line.lineTotal / quantity) : null);
    const code = line.code?.trim() ?? "";
    return {
      ...emptyLine(),
      invoiceDescription: line.description,
      invoiceCode: code,
      mode: line.matchedProduct ? "existing" : "new",
      product: line.matchedProduct,
      newName: line.description,
      newTaxRate: String(line.taxRate ?? 19),
      // Solo un codigo de 8 a 14 digitos parece codigo de barras; una referencia del proveedor no.
      newBarcode: /^\d{8,14}$/.test(code) ? code : "",
      quantity: String(quantity),
      unitCost: unitCost != null ? String(unitCost) : "",
    };
  });
}

export function linesTotal(lines: PurchaseLine[]): number {
  return round2(lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0));
}

/** Mismo margen que la API: un peso por renglon por redondeo de costos unitarios. */
export function linesMatchSubtotal(lines: PurchaseLine[], subtotal: number): boolean {
  return Math.abs(linesTotal(lines) - round2(subtotal)) <= lines.length;
}

/** Que le falta a cada renglon para poder registrarse -- vacio si esta completo. */
export function lineProblem(line: PurchaseLine): string | null {
  if (line.mode === "existing" && !line.product) return "Elige el producto";
  if (line.mode === "new") {
    if (!line.newName.trim()) return "Falta el nombre del producto nuevo";
    if (line.newSalePrice === "" || Number(line.newSalePrice) < 0) return "Falta el precio de venta";
  }
  if (!(Number(line.quantity) > 0)) return "Cantidad invalida";
  if (line.unitCost === "" || Number(line.unitCost) < 0) return "Falta el costo";
  return null;
}

export function linesToItems(lines: PurchaseLine[]): PurchaseItemInput[] {
  return lines.map((l) => ({
    ...(l.mode === "existing"
      ? { productId: l.product!.id }
      : {
          newProduct: {
            name: l.newName.trim(),
            salePrice: Number(l.newSalePrice),
            taxRate: Number(l.newTaxRate),
            barcode: l.newBarcode.trim() || undefined,
          },
        }),
    quantity: Number(l.quantity),
    unitCost: Number(l.unitCost),
  }));
}

interface PurchaseItemsEditorProps {
  lines: PurchaseLine[];
  onChange: (lines: PurchaseLine[]) => void;
  subtotal: number;
  onUseAsSubtotal: (total: number) => void;
}

/**
 * Productos que entran al inventario con la compra. Si la lista queda vacia, la compra solo se
 * contabiliza (servicios, o mercancia que se recibe aparte con una orden de compra).
 */
export function PurchaseItemsEditor({ lines, onChange, subtotal, onUseAsSubtotal }: PurchaseItemsEditorProps) {
  const update = (key: string, patch: Partial<PurchaseLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = linesTotal(lines);
  const matches = linesMatchSubtotal(lines, subtotal);

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Productos que entran al inventario</h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          onClick={() => onChange([...lines, emptyLine()])}
        >
          <Plus size={14} /> agregar producto
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        {lines.length === 0
          ? "Sin productos, la compra solo se contabiliza (servicios o mercancia que recibes con una orden de compra)."
          : "Al registrar la compra se suman estas cantidades al inventario y se actualiza el costo. Costos unitarios antes de IVA."}
      </p>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const problem = lineProblem(line);
          const lineTotal = round2((Number(line.quantity) || 0) * (Number(line.unitCost) || 0));
          return (
            <div key={line.key} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">Renglon {index + 1}</span>
                  {line.invoiceDescription && (
                    <>
                      {" "}
                      · En la factura: {line.invoiceDescription}
                      {line.invoiceCode && ` (${line.invoiceCode})`}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-danger-600"
                  title="Quitar renglon"
                  onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  {line.mode === "existing" ? (
                    <>
                      <ProductPicker
                        value={line.product}
                        initialSearch={line.invoiceDescription}
                        onChange={(product) => update(line.key, { product })}
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-brand-600 hover:underline"
                        onClick={() => update(line.key, { mode: "new", product: null })}
                      >
                        No existe: crearlo como producto nuevo
                      </button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder="Nombre del producto nuevo"
                        value={line.newName}
                        onChange={(e) => update(line.key, { newName: e.target.value })}
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="Precio de venta (sin IVA)"
                          value={line.newSalePrice}
                          onChange={(e) => update(line.key, { newSalePrice: e.target.value })}
                        />
                        <Select value={line.newTaxRate} onChange={(e) => update(line.key, { newTaxRate: e.target.value })}>
                          <option value="19">IVA 19%</option>
                          <option value="5">IVA 5%</option>
                          <option value="0">Sin IVA</option>
                        </Select>
                      </div>
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-brand-600 hover:underline"
                        onClick={() => update(line.key, { mode: "existing" })}
                      >
                        Ya existe: elegirlo del inventario
                      </button>
                    </>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Cantidad"
                    title="Cantidad"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Costo unitario"
                    title="Costo unitario antes de IVA"
                    value={line.unitCost}
                    onChange={(e) => update(line.key, { unitCost: e.target.value })}
                  />
                </div>
                <p className="self-center text-right text-sm font-medium text-slate-900 sm:col-span-2">{formatCOP(lineTotal)}</p>
              </div>
              {problem && <p className="mt-2 text-xs text-warning-700">{problem}</p>}
            </div>
          );
        })}
      </div>

      {lines.length > 0 && (
        <div className="mt-3">
          {matches ? (
            <p className="text-sm text-slate-600">
              Los productos suman <span className="font-semibold text-slate-900">{formatCOP(total)}</span>, igual al subtotal de la factura.
            </p>
          ) : (
            <Alert tone="warning">
              Los productos suman {formatCOP(total)} y el subtotal de la factura es {formatCOP(subtotal)}. Revisa cantidades y costos
              (antes de IVA, con descuentos), o{" "}
              <button type="button" className="font-medium underline" onClick={() => onUseAsSubtotal(total)}>
                usa {formatCOP(total)} como subtotal
              </button>
              .
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
