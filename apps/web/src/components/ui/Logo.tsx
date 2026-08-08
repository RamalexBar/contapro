import logoUrl from "../../assets/logo-contapro.png";

interface LogoProps {
  className?: string;
}

/** Logo real de Contapro (reemplaza el icono generico "Blocks" de lucide-react que se usaba
 * como placeholder). La imagen ya trae su propio fondo oscuro con degradado -- se muestra tal
 * cual con esquinas redondeadas, sin forzar transparencia, para no perder la iluminacion del
 * diseno original. */
export function Logo({ className = "h-10" }: LogoProps) {
  return <img src={logoUrl} alt="Contapro" className={`w-auto rounded-lg ${className}`} />;
}
