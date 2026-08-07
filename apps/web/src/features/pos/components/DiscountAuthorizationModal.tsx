import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";

interface Props {
  saleItemId: string;
  onCancel: () => void;
  onSubmit: (input: { authorizerUserId: string; pin?: string; password?: string; reason?: string }) => void;
  isSubmitting: boolean;
}

export function DiscountAuthorizationModal({ saleItemId, onCancel, onSubmit, isSubmitting }: Props) {
  const [authorizerUserId, setAuthorizerUserId] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-sm">
        <h2 className="mb-1 text-base font-semibold text-slate-900">Autorizacion de descuento requerida</h2>
        <p className="mb-4 text-xs text-slate-500">Item {saleItemId} supera el limite de descuento del cajero.</p>
        <div className="space-y-3">
          <Input
            label="ID del supervisor/admin autorizador"
            value={authorizerUserId}
            onChange={(e) => setAuthorizerUserId(e.target.value)}
          />
          <Input label="PIN del autorizador" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting || !authorizerUserId || !pin}
              loading={isSubmitting}
              onClick={() => onSubmit({ authorizerUserId, pin, reason })}
            >
              Autorizar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
