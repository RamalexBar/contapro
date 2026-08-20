import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { AccountRecord } from "../api/accounting.api";

interface AccountComboboxProps {
  accounts: AccountRecord[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
  /** Por defecto solo deja elegir cuentas activas que admiten movimientos directos (lineas de
   * comprobante, libro mayor). El selector de cuenta padre pasa un filtro mas permisivo, ya que
   * el padre puede ser cualquier cuenta del catalogo, activa o no. */
  filter?: (account: AccountRecord) => boolean;
  disabled?: boolean;
}

const DEFAULT_FILTER = (a: AccountRecord) => a.isActive && a.acceptsEntries;
const MAX_RESULTS = 50;

/**
 * Buscador de cuentas del PUC por codigo (cascada por prefijo: escribir "15" muestra 15, 1504,
 * 150405...) o por nombre, en vez del <select> plano que listaba todas las cuentas de una vez --
 * item 44 de docs/ALCANCE.md. El usuario nunca necesita escribir el nombre completo, solo el
 * codigo que ya conoce.
 */
export function AccountCombobox({ accounts, value, onChange, placeholder, filter = DEFAULT_FILTER, disabled }: AccountComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const selected = accounts.find((a) => a.id === value) ?? null;

  const options = useMemo(() => {
    const pool = [...accounts].filter(filter).sort((a, b) => a.code.localeCompare(b.code));
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, MAX_RESULTS);
    return pool.filter((a) => a.code.startsWith(q) || a.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [accounts, filter, query]);

  function selectAccount(account: AccountRecord) {
    onChange(account.id);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[highlighted];
      if (option) selectAccount(option);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        disabled={disabled}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
        placeholder={placeholder ?? "Codigo de la cuenta..."}
        value={open ? query : selected ? `${selected.code} — ${selected.name}` : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlighted(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {options.length === 0 && <li className="px-3 py-2 text-slate-400">Sin resultados</li>}
          {options.map((a, i) => (
            <li
              key={a.id}
              style={{ paddingLeft: 12 + (a.level - 1) * 14 }}
              className={`cursor-pointer py-1.5 pr-3 ${i === highlighted ? "bg-brand-50 text-brand-700" : "text-slate-700"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                selectAccount(a);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="font-mono text-xs text-slate-500">{a.code}</span> {a.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
