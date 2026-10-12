import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { listMyBranches, switchBranch } from "../../features/auth/api/auth.api";

/**
 * Sucursal en la que se esta trabajando (ventas, caja y compras salen de esta), en la barra
 * superior. Con una sola sucursal disponible solo la muestra; con varias deja cambiar. Al cambiar
 * se recarga la pagina: el punto de venta, la caja y los formularios leen la sucursal al cargar.
 */
export function BranchSwitcher() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setSession = useAuthStore((s) => s.setSession);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  const { data } = useQuery({ queryKey: ["auth", "my-branches", user?.id], queryFn: listMyBranches, enabled: Boolean(user), staleTime: 60_000 });
  const branches = data?.data ?? [];
  const current = branches.find((b) => b.id === user?.branchId);

  if (branches.length === 0) return null;

  async function onChange(branchId: string) {
    if (!refreshToken || branchId === user?.branchId) return;
    setSwitching(true);
    setError("");
    try {
      const result = await switchBranch(branchId);
      setSession(result.accessToken, refreshToken, result.user);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar de sucursal");
      setSwitching(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-700" title={error || "Sucursal en la que estas trabajando"}>
      <Store size={18} className={error ? "shrink-0 text-danger-500" : "shrink-0 text-slate-400"} />
      {branches.length === 1 ? (
        <span className="max-w-[10rem] truncate font-medium">{current?.name ?? branches[0]!.name}</span>
      ) : (
        <select
          aria-label="Sucursal"
          className="max-w-[11rem] truncate rounded-md border border-slate-300 bg-white py-1 pl-2 pr-7 text-sm font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
          value={user?.branchId ?? ""}
          disabled={switching}
          onChange={(e) => void onChange(e.target.value)}
        >
          {!current && <option value="">Elegir sucursal</option>}
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
