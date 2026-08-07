import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyDiscount, calculateTax, formatCOP, formatCurrency, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { listProducts } from "../../inventory/api/product.api";
import { getActiveSession, listCashRegisters } from "../../cash/api/cash.api";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { authorizeDiscount, createSale, listSaleWhatsAppDeliveries, resendSaleWhatsApp, type SaleResponse } from "../api/sale.api";
import { DiscountAuthorizationModal } from "../components/DiscountAuthorizationModal";
import { listWithholdingConcepts } from "../../accounting/api/accounting.api";
import { listCustomers } from "../../customers/api/customer.api";
import { listPriceLists, listProductPrices } from "../../inventory/api/price-list.api";

interface CartLine {
  productId: string;
  quantity: number;
  discountPercent: number;
}

interface CartWithholding {
  withholdingConceptId: string;
  base: number;
}

function lineTotal(unitPrice: number, quantity: number, discountPercent: number, taxRate: number): number {
  const subtotal = round2(unitPrice * quantity);
  const taxableBase = applyDiscount(subtotal, discountPercent);
  const taxAmount = calculateTax(taxableBase, taxRate);
  return round2(taxableBase + taxAmount);
}

export function POSPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data: registers } = useQuery({ queryKey: ["cash-registers"], queryFn: listCashRegisters });
  const registerId = registers?.data[0]?.id;
  const { data: activeSession } = useQuery({
    queryKey: ["cash-active-session", registerId],
    queryFn: () => getActiveSession(registerId as string),
    enabled: Boolean(registerId),
  });

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  // Retenciones solo tiene sentido mostrarlas a quien puede ver contabilidad (ver
  // accounting.container.ts, rutas gateadas por accounting.read) -- CAJERO no lo tiene por
  // defecto, asi que su checkout normal queda visualmente identico a antes. El backend igual
  // exige el permiso en la ruta sin importar esto.
  const canApplyWithholdings = hasPermission("accounting.read");
  const { data: withholdingConcepts } = useQuery({
    queryKey: ["withholding-concepts"],
    queryFn: listWithholdingConcepts,
    enabled: canApplyWithholdings,
  });
  const activeConcepts = withholdingConcepts?.data.filter((c) => c.isActive) ?? [];

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });

  const { data: priceLists } = useQuery({ queryKey: ["price-lists"], queryFn: listPriceLists });
  const activePriceLists = priceLists?.data.filter((pl) => pl.isActive) ?? [];

  const [cart, setCart] = useState<CartLine[]>([]);
  const [withholdings, setWithholdings] = useState<CartWithholding[]>([]);
  // "CREDIT" reusa el mecanismo de pago que ya existia (ver resolve-receivable-input.ts, item 31)
  // -- elegirlo genera una AccountReceivable en vez de cobrar de una vez.
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT">("CASH");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- solo etiqueta el total con una
  // moneda extranjera + TRM manual para mostrar un total de referencia; la venta se sigue
  // cobrando/contabilizando en COP igual que siempre.
  const [currency, setCurrency] = useState("COP");
  const [exchangeRate, setExchangeRate] = useState("");
  // Lista de precios (item 35 de docs/ALCANCE.md). Vacio = usar la lista asignada al cliente (si
  // tiene) o el precio base -- misma resolucion que hace el backend (resolveEffectivePriceListId).
  // El cajero puede forzar una lista puntual independientemente del cliente elegido.
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [sale, setSale] = useState<SaleResponse | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const selectedCustomer = customers?.data.find((c) => c.id === customerId);
  // Mismo criterio de resolucion que el backend: lista explicita > lista del cliente > null (precio base).
  const effectivePriceListId = selectedPriceListId || selectedCustomer?.priceListId || "";
  const { data: productPrices } = useQuery({
    queryKey: ["price-list-prices", effectivePriceListId],
    queryFn: () => listProductPrices(effectivePriceListId),
    enabled: Boolean(effectivePriceListId),
  });
  const priceOverrides = new Map((productPrices?.data ?? []).map((p) => [p.productId, p.price]));

  function resolvePrice(productId: string, basePrice: number): number {
    return priceOverrides.get(productId) ?? basePrice;
  }

  const subtotal = round2(
    cart.reduce((sum, l) => {
      const product = products?.data.find((p) => p.id === l.productId);
      if (!product) return sum;
      const unitPrice = resolvePrice(l.productId, product.currentPrice);
      return sum + applyDiscount(round2(unitPrice * l.quantity), l.discountPercent);
    }, 0)
  );
  const total = round2(
    cart.reduce((sum, l) => {
      const product = products?.data.find((p) => p.id === l.productId);
      if (!product) return sum;
      const unitPrice = resolvePrice(l.productId, product.currentPrice);
      return sum + lineTotal(unitPrice, l.quantity, l.discountPercent, product.taxRate);
    }, 0)
  );
  const retentionTotal = round2(
    withholdings.reduce((sum, w) => {
      const concept = activeConcepts.find((c) => c.id === w.withholdingConceptId);
      return sum + (concept ? calculateTax(w.base, concept.ratePercent) : 0);
    }, 0)
  );
  const netTotal = round2(total - retentionTotal);

  const saleMutation = useMutation({
    mutationFn: () =>
      createSale({
        branchId: user!.branchId!,
        cashSessionId: activeSession?.id,
        customerId: customerId || undefined,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, discountPercent: l.discountPercent })),
        payments: [{ method: paymentMethod, amount: netTotal }],
        withholdings,
        dueDate: paymentMethod === "CREDIT" && dueDate ? new Date(dueDate) : undefined,
        currency,
        exchangeRate: currency === "COP" ? 1 : Number(exchangeRate),
        priceListId: selectedPriceListId || undefined,
      }),
    onSuccess: (result) => {
      setSale(result);
      if (result.status === "PENDING_AUTHORIZATION") {
        const item = result.items.find((i) => i.requiresDiscountAuthorization);
        setPendingItemId(item?.id ?? null);
      } else {
        setCart([]);
        setWithholdings([]);
        setPaymentMethod("CASH");
        setCustomerId("");
        setDueDate("");
        setCurrency("COP");
        setExchangeRate("");
        setSelectedPriceListId("");
      }
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: (input: { authorizerUserId: string; pin?: string; password?: string; reason?: string }) =>
      authorizeDiscount(sale!.id, { saleItemId: pendingItemId!, ...input }),
    onSuccess: (result) => {
      setSale(result);
      setPendingItemId(null);
      if (result.status === "COMPLETED") setCart([]);
    },
  });

  function addToCart(product: { id: string }) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, quantity: 1, discountPercent: 0 }];
    });
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Punto de venta</h1>
      {!activeSession && (
        <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
          No hay una caja abierta. Abre una sesion de caja para registrar ventas con ingreso automatico de efectivo.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Productos</h2>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <label className="text-gray-600">Lista de precios:</label>
            <select
              className="flex-1 rounded border border-gray-200 px-2 py-1"
              value={selectedPriceListId}
              onChange={(e) => setSelectedPriceListId(e.target.value)}
            >
              <option value="">
                {selectedCustomer?.priceListId ? "Usar la del cliente" : "Precio base"}
              </option>
              {activePriceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {products?.data.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex w-full items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span>{p.name}</span>
                <span className="text-gray-500">{formatCOP(resolvePrice(p.id, p.currentPrice))}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Carrito</h2>
          <div className="space-y-2">
            {cart.map((line) => {
              const product = products?.data.find((p) => p.id === line.productId);
              const unitPrice = resolvePrice(line.productId, product?.currentPrice ?? 0);
              return (
                <div key={line.productId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{product?.name ?? line.productId}</span>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    className="w-16 rounded border border-gray-200 px-2 py-1"
                    onChange={(e) =>
                      setCart((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, quantity: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={line.discountPercent}
                    title="% descuento"
                    className="w-16 rounded border border-gray-200 px-2 py-1"
                    onChange={(e) =>
                      setCart((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, discountPercent: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <span className="w-24 text-right">{formatCOP(lineTotal(unitPrice, line.quantity, line.discountPercent, product?.taxRate ?? 0))}</span>
                </div>
              );
            })}
            {cart.length === 0 && <p className="text-sm text-gray-400">Agrega productos desde la izquierda</p>}
          </div>

          {canApplyWithholdings && cart.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Retenciones</h3>
                {activeConcepts.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      const first = activeConcepts[0];
                      if (!first) return;
                      setWithholdings((prev) => [...prev, { withholdingConceptId: first.id, base: subtotal }]);
                    }}
                  >
                    + agregar retencion
                  </button>
                )}
              </div>
              {withholdings.map((w, i) => (
                <div key={i} className="mb-2 flex items-center gap-2 text-sm">
                  <select
                    className="flex-1 rounded border border-gray-200 px-2 py-1"
                    value={w.withholdingConceptId}
                    onChange={(e) =>
                      setWithholdings((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, withholdingConceptId: e.target.value } : row))
                      )
                    }
                  >
                    {activeConcepts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.ratePercent}%)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={subtotal}
                    value={w.base}
                    title="Base de retencion"
                    className="w-28 rounded border border-gray-200 px-2 py-1"
                    onChange={(e) =>
                      setWithholdings((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, base: Number(e.target.value) } : row))
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => setWithholdings((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <label className="text-gray-600">Pago:</label>
                <select
                  className="rounded border border-gray-200 px-2 py-1"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "CREDIT")}
                >
                  <option value="CASH">Efectivo (de una vez)</option>
                  <option value="CREDIT">A credito</option>
                </select>
              </div>
              {/* Cliente: opcional para pago de contado (venta a "consumidor final"), obligatorio
                  a credito -- el backend genera la AccountReceivable (item 31) contra este
                  cliente. */}
              <div className="mb-2 flex items-center gap-2 text-sm">
                <label className="text-gray-600">Cliente{paymentMethod === "CREDIT" ? " *" : ""}:</label>
                <select
                  className="flex-1 rounded border border-gray-200 px-2 py-1"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required={paymentMethod === "CREDIT"}
                >
                  <option value="">{paymentMethod === "CREDIT" ? "Seleccionar..." : "Consumidor final"}</option>
                  {customers?.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {paymentMethod === "CREDIT" && (
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <label className="text-gray-600">Vence:</label>
                  <input
                    type="date"
                    className="rounded border border-gray-200 px-2 py-1"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="30 dias por defecto"
                  />
                </div>
              )}
              <div className="mb-2 flex items-center gap-2 text-sm">
                <label className="text-gray-600">Moneda:</label>
                <select
                  className="rounded border border-gray-200 px-2 py-1"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                {currency !== "COP" && (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="TRM (COP por 1 unidad)"
                    className="w-40 rounded border border-gray-200 px-2 py-1"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          <div className="mt-2 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            {retentionTotal > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Retenciones</span>
                <span>-{formatCOP(retentionTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-gray-900">{paymentMethod === "CREDIT" ? "Total a credito" : "Total a cobrar"}</span>
              <span className="font-semibold text-gray-900">{formatCOP(netTotal)}</span>
            </div>
            {currency !== "COP" && Number(exchangeRate) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Referencia en {currency}</span>
                <span>{formatCurrency(round2(netTotal / Number(exchangeRate)), currency)}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              disabled={
                cart.length === 0 ||
                saleMutation.isPending ||
                (paymentMethod === "CREDIT" && !customerId) ||
                (currency !== "COP" && !(Number(exchangeRate) > 0))
              }
              onClick={() => saleMutation.mutate()}
            >
              {paymentMethod === "CREDIT" ? "Vender a credito" : "Cobrar"}
            </Button>
          </div>

          {sale?.status === "COMPLETED" && (
            <>
              <p className="mt-3 text-sm text-green-600">Venta #{sale.number} completada.</p>
              {sale.customerId && <SaleWhatsAppStatus saleId={sale.id} />}
            </>
          )}
        </Card>
      </div>

      {pendingItemId && (
        <DiscountAuthorizationModal
          saleItemId={pendingItemId}
          isSubmitting={authorizeMutation.isPending}
          onCancel={() => setPendingItemId(null)}
          onSubmit={(input) => authorizeMutation.mutate(input)}
        />
      )}
    </AppLayout>
  );
}

/** Item 41 de docs/ALCANCE.md: estado de envio del RIDE por WhatsApp + reenvio manual si fallo. */
function SaleWhatsAppStatus({ saleId }: { saleId: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["sale-whatsapp-deliveries", saleId],
    queryFn: () => listSaleWhatsAppDeliveries(saleId),
  });
  const resendMutation = useMutation({
    mutationFn: () => resendSaleWhatsApp(saleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sale-whatsapp-deliveries", saleId] }),
  });

  const latest = data?.data[0];
  if (!latest) return null;

  return (
    <p className="mt-1 text-sm text-gray-500">
      {latest.success ? (
        "Factura enviada por WhatsApp."
      ) : (
        <>
          No se pudo enviar la factura por WhatsApp ({latest.errorMessage}).
          {hasPermission("electronic-invoicing.manage") && (
            <Button
              variant="secondary"
              disabled={resendMutation.isPending}
              onClick={() => resendMutation.mutate()}
              className="ml-2"
            >
              Reenviar
            </Button>
          )}
        </>
      )}
    </p>
  );
}
