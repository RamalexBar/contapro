import { Outlet, ScrollRestoration } from "react-router-dom";
import { ContactWidget } from "../components/ui/ContactWidget";

/** Envuelve todas las rutas publicas y de la app (landing, auth, dashboard, POS, etc.) para que
 * ContactWidget aparezca siempre, sin repetirlo en cada pagina. Las rutas de /admin/* (panel de
 * plataforma) quedan deliberadamente FUERA de este layout, ver router.tsx -- ese panel lo usa el
 * propio equipo de Contapro, no tiene sentido mostrarles su propio boton de contacto. */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ContactWidget />
      {/* Cada pagina nueva abre arriba (antes quedaba en la posicion de la anterior: al pasar de una
          pagina larga a Clientes se veia la mitad vacia); con "Atras" vuelve a donde estaba. */}
      <ScrollRestoration />
    </>
  );
}
