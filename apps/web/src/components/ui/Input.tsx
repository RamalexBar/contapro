import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <input
        id={id}
        className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400 ${
          error ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500" : "border-slate-300 focus:border-brand-500 focus:ring-brand-500"
        } ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger-600">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
