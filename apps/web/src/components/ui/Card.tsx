import type { PropsWithChildren, ReactNode } from "react";

interface CardProps {
  className?: string;
  /** Titulo opcional -- si se pasa, se renderiza en un header con borde inferior propio, junto a
   * `actions` (ej. un boton "Nuevo") alineado a la derecha. */
  title?: ReactNode;
  actions?: ReactNode;
  /** Quita el padding del body -- util para que una tabla ocupe el ancho completo de la tarjeta
   * sin el padding estandar de 16px alrededor. */
  noPadding?: boolean;
}

export function Card({ children, className = "", title, actions, noPadding = false }: PropsWithChildren<CardProps>) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </div>
  );
}
