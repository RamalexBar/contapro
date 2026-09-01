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
 * Logo real de Contapro (el archivo que compartio el usuario, no el generado por IA que tenia
 * antes esta funcion). Se proceso una sola vez para separar el trazo del fondo gris plano: el
 * fondo es un color solido y la tinta es negro puro, asi que el canal alfa se recupera
 * matematicamente (unmultiply) en vez de con un umbral -- el resultado conserva el anti-aliasing
 * original de los bordes, sin verse dentado. Se generaron dos variantes con el mismo alfa: tinta
 * oscura (`contapro-logo-dark.png`, `--ink` #111827) para fondos claros, y tinta blanca
 * (`contapro-logo-light.png`) para el panel de plataforma, que tiene sidebar oscuro.
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
