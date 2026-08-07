import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Envoltorios delgados sobre los elementos nativos de tabla, con estilos consistentes -- antes
 * cada pagina armaba su propia tabla con clases repetidas (y con drift real entre paginas). Se
 * usan igual que los elementos HTML que reemplazan (`<Table><TableHead>...`), solo cambia el
 * nombre de la etiqueta.
 */
export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHead({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-slate-100 ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-slate-50 ${className}`} {...props} />;
}

export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-3 py-2.5 font-medium ${className}`} {...props} />;
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3 py-2.5 text-slate-700 ${className}`} {...props} />;
}
