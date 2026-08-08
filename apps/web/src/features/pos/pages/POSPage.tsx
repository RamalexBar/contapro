import { useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyDiscount, calculateTax, formatCOP, formatCurrency, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { listProducts } from "../../inventory/api/product.api";
import { getActiveSession, listCashRegisters } from "../../cash/api/cash.api";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { authorizeDiscount, createSale, listSaleWhatsAppDeliveries, printThermalReceipt, resendSaleWhatsApp, type SaleResponse } from "../api/sale.api";
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

  const printMutation = useMutation({
    mutationFn: (saleId: string) => printThermalReceipt(saleId),
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

  // Un lector de codigo de barras USB/Bluetooth funciona como un teclado: "escribe" el codigo
  // en el campo enfocado y termina con Enter. Filtramos en el cliente (el catalogo completo ya
  // se carga de una vez, tope de 100 productos igual que el resto de la app) para que ese Enter
  // agregue el producto sin round-trip adicional al backend.
  const [productSearch, setProductSearch] = useState("");
  const normalizedSearch = productSearch.trim().toLowerCase();
  const visibleProducts = (products?.data ?? []).filter((p) => {
    if (!normalizedSearch) return true;
    return p.name.toLowerCase().includes(normalizedSearch) || p.barcodes.some((b) => b.toLowerCase().includes(normalizedSearch));
  });

  function handleProductSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = productSearch.trim();
    if (!term) return;
    const exactBarcodeMatch = products?.data.find((p) => p.barcodes.includes(term));
    const singleVisibleMatch = visibleProducts.length === 1 ? visibleProducts[0] : undefined;
    const match = exactBarcodeMatch ?? singleVisibleMatch;
    if (match) {
      addToCart(match);
      setProductSearch("");
    }
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Punto de venta</h1>
      {!activeSession && (
        <Alert tone="warning" className="mb-4">
          No hay una caja abierta. Abre una sesion de caja para registrar ventas con ingreso automatico de efectivo.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Productos</h2>
          <Input
            className="mb-3"
            placeholder="Buscar por nombre o escanear codigo de barras"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            onKeyDown={handleProductSearchKeyDown}
            autoFocus
          />
          <div className="mb-3 flex items-center gap-2 text-sm">
            <label className="text-slate-600">Lista de precios:</label>
            <Select className="flex-1" value={selectedPriceListId} onChange={(e) => setSelectedPriceListId(e.target.value)}>
              <option value="">{selectedCustomer?.priceListId ? "Usar la del cliente" : "Precio base"}</option>
              {activePriceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="max-h-96 space-y-1.5 overflow-y-auto">
            {visibleProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="text-slate-800">{p.name}</span>
                <span className="font-medium text-slate-500">{formatCOP(resolvePrice(p.id, p.currentPrice))}</span>
              </button>
            ))}
            {normalizedSearch && visibleProducts.length === 0 && (
              <p className="px-1 py-2 text-sm text-slate-500">Ningun producto coincide con "{productSearch.trim()}".</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Carrito</h2>
          <div className="space-y-2">
            {cart.map((line) => {
              const product = products?.data.find((p) => p.id === line.productId);
              const unitPrice = resolvePrice(line.productId, product?.currentPrice ?? 0);
              return (
                <div key={line.productId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-slate-800">{product?.name ?? line.productId}</span>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    className="w-16"
                    onChange={(e) =>
                      setCart((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, quantity: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={line.discountPercent}
                    title="% descuento"
                    className="w-16"
                    onChange={(e) =>
                      setCart((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, discountPercent: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <span className="w-24 text-right font-medium text-slate-700">
                    {formatCOP(lineTotal(unitPrice, line.quantity, line.discountPercent, product?.taxRate ?? 0))}
                  </span>
                </div>
              );
            })}
            {cart.length === 0 && <p className="text-sm text-slate-400">Agrega productos desde la izquierda</p>}
          </div>

          {canApplyWithholdings && cart.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Retenciones</h3>
                {activeConcepts.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:underline"
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
                  <Select
                    className="flex-1"
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
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={subtotal}
                    value={w.base}
                    title="Base de retencion"
                    className="w-28"
                    onChange={(e) =>
                      setWithholdings((prev) => prev.map((row, idx) => (idx === i ? { ...row, base: Number(e.target.value) } : row)))
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-danger-500 hover:underline"
                    onClick={() => setWithholdings((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 text-sm">
                <label className="w-20 shrink-0 text-slate-600">Pago:</label>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "CREDIT")}>
                  <option value="CASH">Efectivo (de una vez)</option>
                  <option value="CREDIT">A credito</option>
                </Select>
              </div>
              {/* Cliente: opcional para pago de contado (venta a "consumidor final"), obligatorio
                  a credito -- el backend genera la AccountReceivable (item 31) contra este
                  cliente. */}
              <div className="flex items-center gap-2 text-sm">
                <label className="w-20 shrink-0 text-slate-600">Cliente{paymentMethod === "CREDIT" ? " *" : ""}:</label>
                <Select className="flex-1" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required={paymentMethod === "CREDIT"}>
                  <option value="">{paymentMethod === "CREDIT" ? "Seleccionar..." : "Consumidor final"}</option>
                  {customers?.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              {paymentMethod === "CREDIT" && (
                <div className="flex items-center gap-2 text-sm">
                  <label className="w-20 shrink-0 text-slate-600">Vence:</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="30 dias por defecto" />
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <label className="w-20 shrink-0 text-slate-600">Moneda:</label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
                {currency !== "COP" && (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="TRM (COP por 1 unidad)"
                    className="w-40"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          <div className="mt-2 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            {retentionTotal > 0 && (
              <div className="flex justify-between text-danger-600">
                <span>Retenciones</span>
                <span>-{formatCOP(retentionTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-slate-900">{paymentMethod === "CREDIT" ? "Total a credito" : "Total a cobrar"}</span>
              <span className="text-lg font-semibold text-slate-900">{formatCOP(netTotal)}</span>
            </div>
            {currency !== "COP" && Number(exchangeRate) > 0 && (
              <div className="flex justify-between text-slate-500">
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
              loading={saleMutation.isPending}
              onClick={() => saleMutation.mutate()}
            >
              {paymentMethod === "CREDIT" ? "Vender a credito" : "Cobrar"}
            </Button>
          </div>

          {sale?.status === "COMPLETED" && (
            <div className="mt-3">
              <Alert tone="success">Venta #{sale.number} completada.</Alert>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="secondary"
                  loading={printMutation.isPending}
                  onClick={() => printMutation.mutate(sale.id)}
                >
                  Imprimir tirilla
                </Button>
                {printMutation.isError && (
                  <span className="text-xs text-danger-600">No se pudo generar la tirilla. Intenta de nuevo.</span>
                )}
              </div>
              {sale.customerId && <SaleWhatsAppStatus saleId={sale.id} />}
            </div>
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
    <p className="mt-2 text-sm text-slate-500">
      {latest.success ? (
        "Factura enviada por WhatsApp."
      ) : (
        <>
          No se pudo enviar la factura por WhatsApp ({latest.errorMessage}).
          {hasPermission("electronic-invoicing.manage") && (
            <Button size="sm" variant="secondary" loading={resendMutation.isPending} onClick={() => resendMutation.mutate()} className="ml-2">
              Reenviar
            </Button>
          )}
        </>
      )}
    </p>
  );
}
