import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAuthStore } from "../hooks/usePlatformAuthStore";

export function PlatformProtectedRoute({ children }: PropsWithChildren) {
  const accessToken = usePlatformAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
