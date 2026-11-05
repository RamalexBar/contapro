import { useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { findDaneMunicipality, searchDaneMunicipalities, type DaneMunicipality } from "@erp/shared-utils";

interface MunicipalitySelectProps {
  /** Codigo DANE elegido ("66001"), vacio si no hay. */
  value: string;
  onChange: (municipality: DaneMunicipality | null) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Ciudad o municipio de Colombia con su codigo DANE (catalogo DIVIPOLA de @erp/shared-utils): la
 * persona busca por nombre ("pereira") y se guarda el codigo, que es lo que exige la DIAN/Factus.
 */
export function MunicipalitySelect({ value, onChange, label = "Ciudad o municipio", hint, required, disabled }: MunicipalitySelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selected = findDaneMunicipality(value);
  const results = searchDaneMunicipalities(search, 8);

  return (
    <div className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-danger-600"> *</span>}
        </span>
      )}
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 truncate text-slate-900">
            <MapPin size={14} className="shrink-0 text-slate-400" />
            {selected.name}, {selected.department} <span className="text-slate-400">({selected.code})</span>
          </span>
          {!disabled && (
            <button type="button" className="shrink-0 text-slate-400 hover:text-slate-700" title="Cambiar" onClick={() => onChange(null)}>
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
          <input
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
            placeholder="Escriba la ciudad, ej. Pereira"
            value={search}
            disabled={disabled}
            // El formulario no se envia sin elegir uno de la lista (el texto suelto no sirve: hace falta el codigo).
            required={required}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {results.map((m) => (
                <li key={m.code}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(m);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <span className="text-slate-900">{m.name}</span>
                    <span className="text-slate-400"> · {m.department}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && search.trim().length >= 2 && results.length === 0 && (
            <p className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
              No encontramos ese municipio.
            </p>
          )}
        </div>
      )}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </div>
  );
}
