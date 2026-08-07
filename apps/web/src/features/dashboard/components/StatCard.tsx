import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../../../components/ui/Card";

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  );
}
