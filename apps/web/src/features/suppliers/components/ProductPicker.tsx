import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { listProducts } from "../../inventory/api/product.api";

export interface PickedProduct {
  id: string;
  name: string;
  sku: string;
}

interface ProductPickerProps {
  value: PickedProduct | null;
  onChange: (product: PickedProduct | null) => void;
  /** Texto con el que arranca la busqueda (la descripcion del renglon de la factura). */
  initialSearch?: string;
}

/**
 * Buscador de productos para un renglon de compra: GET /products?search= devuelve hasta 100, asi
 * que se busca por nombre en vez de cargar un select con todo el catalogo.
 */
export function ProductPicker({ value, onChange, initialSearch = "" }: ProductPickerProps) {
  const [search, setSearch] = useState(initialSearch);
  const [debounced, setDebounced] = useState(initialSearch);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ["products", "search", debounced],
    queryFn: () => listProducts(debounced),
    enabled: open && debounced.length >= 2,
  });
  const results = (data?.data ?? []).slice(0, 8);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
        <span className="min-w-0 truncate text-slate-900">
          {value.name} <span className="text-slate-400">({value.sku})</span>
        </span>
        <button type="button" className="shrink-0 text-slate-400 hover:text-slate-700" title="Cambiar producto" onClick={() => onChange(null)}>
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
      <input
        className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        placeholder="Buscar producto por nombre..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Deja terminar el clic en un resultado antes de cerrar la lista.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && debounced.length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">{isFetching ? "Buscando..." : "Ningun producto con ese nombre"}</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-brand-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ id: p.id, name: p.name, sku: p.sku });
                    setOpen(false);
                  }}
                >
                  {p.name} <span className="text-slate-400">({p.sku})</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
