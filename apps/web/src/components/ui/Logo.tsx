import iconUrl from "../../assets/logo-icon.png";

interface LogoProps {
  /** Alto del icono -- el texto escala en proporcion (ver textSizeClass). */
  iconClassName?: string;
  textSizeClass?: string;
  /** Color del texto en fondos oscuros (panel de plataforma) -- "Pro" mantiene el verde de marca
   * en los dos casos, solo "Conta" cambia de azul marino a blanco. */
  onDark?: boolean;
  className?: string;
}

/**
 * Logo real de Contapro. La imagen generada traia el texto "ContaPro" pintado (no vectorial) --
 * se veia borroso al achicarlo para un header/login. Se aislo solo el icono grafico (el anillo +
 * las barras, que si son formas solidas limpias) con fondo transparente, y el texto se escribe
 * como HTML real al lado -- asi queda nitido a cualquier tamano/resolucion, sin depender de la
 * calidad de la imagen generada.
 */
export function Logo({ iconClassName = "h-9", textSizeClass = "text-xl", onDark = false, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <img src={iconUrl} alt="" className={`w-auto ${iconClassName}`} />
      <span className={`font-bold leading-none tracking-tight ${textSizeClass}`}>
        <span style={{ color: onDark ? "#F8FAFC" : "#0B4DA2" }}>Conta</span>
        <span style={{ color: "#69B423" }}>Pro</span>
      </span>
    </span>
  );
}
