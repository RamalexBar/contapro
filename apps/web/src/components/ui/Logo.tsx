import logoDark from "../../assets/contapro-logo-dark.png";
import logoLight from "../../assets/contapro-logo-light.png";

interface LogoProps {
  /** Alto del wordmark -- el ancho escala solo (la imagen mantiene su proporcion real). */
  heightClassName?: string;
  /** Usa la version en tinta blanca -- fondos oscuros (panel de plataforma). */
  onDark?: boolean;
  className?: string;
}

/**
 * Logo de Contapro con icono (barras de crecimiento) + wordmark, sacado de la pieza cuadrada azul
 * que compartio el usuario (2026-10-08, reemplaza al wordmark solo). Se proceso una sola vez para
 * quitar el fondo azul solido #1E3A8A: el alfa se recupera del canal rojo (unmultiply, no umbral),
 * asi que conserva el anti-aliasing original. Dos variantes con el mismo alfa:
 * - `contapro-logo-dark.png` (fondos claros, casi toda la app): "Conta" en el azul de la marca,
 *   "Pro" en el naranja de la barra (el durazno original no contrasta sobre blanco) y el icono
 *   invertido -- cuadro azul con barras claras.
 * - `contapro-logo-light.png` (fondos oscuros, panel de plataforma): los colores originales.
 * `public/favicon.png` es el icono de la variante clara.
 */
export function Logo({ heightClassName = "h-9", onDark = false, className = "" }: LogoProps) {
  return (
    <img
      src={onDark ? logoLight : logoDark}
      alt="Contapro"
      className={`w-auto ${heightClassName} ${className}`}
    />
  );
}
