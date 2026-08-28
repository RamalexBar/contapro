import { Navigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/hooks/useAuthStore";
import { LandingPage } from "../features/marketing/pages/LandingPage";

/** Visitante sin sesion ve la landing de ventas; con sesion activa va directo al dashboard,
 * mismo criterio de "/" que antes solo redirigia siempre a /dashboard. */
export function HomeRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}
