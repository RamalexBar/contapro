import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { listProducts } from "../../inventory/api/product.api";
import { getActiveSession, listCashRegisters } from "../../cash/api/cash.api";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { authorizeDiscount, createSale, type SaleResponse } from "../api/sale.api";
import { DiscountAuthorizationModal } from "../components/DiscountAuthorizationModal";

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
}

export function POSPage() {
  const user = useAuthStore((s) => s.user);
  const { data: registers } = useQuery({ queryKey: ["cash-registers"], queryFn: listCashRegisters });
  const registerId = registers?.data[0]?.id;
  const { data: activeSession } = useQuery({
    queryKey: ["cash-active-session", registerId],
    queryFn: () => getActiveSession(registerId as string),
    enabled: Boolean(registerId),
  });

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sale, setSale] = useState<SaleResponse | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity * (1 - l.discountPercent / 100), 0);

  const saleMutation = useMutation({
    mutationFn: () =>
      createSale({
        branchId: user!.branchId!,
        cashSessionId: activeSession?.id,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, discountPercent: l.discountPercent })),
        payments: [{ method: "CASH", amount: Math.round(total) }],
      }),
    onSuccess: (result) => {
      setSale(result);
      if (result.status === "PENDING_AUTHORIZATION") {
        const item = result.items.find((i) => i.requiresDiscountAuthorization);
        setPendingItemId(item?.id ?? null);
      } else {
        setCart([]);
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

  function addToCart(product: { id: string; name: string; currentPrice: number }) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, unitPrice: product.currentPrice, quantity: 1, discountPercent: 0 }];
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
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {products?.data.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex w-full items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span>{p.name}</span>
                <span className="text-gray-500">{formatCOP(p.currentPrice)}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Carrito</h2>
          <div className="space-y-2">
            {cart.map((line) => (
              <div key={line.productId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{line.name}</span>
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
                <span className="w-24 text-right">{formatCOP(line.unitPrice * line.quantity * (1 - line.discountPercent / 100))}</span>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-gray-400">Agrega productos desde la izquierda</p>}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="font-semibold">Total: {formatCOP(total)}</span>
            <Button disabled={cart.length === 0 || saleMutation.isPending} onClick={() => saleMutation.mutate()}>
              Cobrar
            </Button>
          </div>

          {sale?.status === "COMPLETED" && <p className="mt-3 text-sm text-green-600">Venta #{sale.number} completada.</p>}
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
