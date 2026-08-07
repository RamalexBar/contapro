import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/** Mismo tratamiento visual que Input -- antes cada pagina armaba el select con su propia
 * variante de radio/borde/padding (rounded vs rounded-md, gray-200 vs gray-300), esto lo unifica. */
export function Select({ label, error, className = "", id, children, ...props }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select
        id={id}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400 ${
          error ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500" : "border-slate-300 focus:border-brand-500 focus:ring-brand-500"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-danger-600">{error}</span>}
    </label>
  );
}
