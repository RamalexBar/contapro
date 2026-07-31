import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlatformAdminUser {
  id: string;
  email: string;
  fullName: string;
}

interface PlatformAuthState {
  accessToken: string | null;
  platformAdmin: PlatformAdminUser | null;
  setSession: (accessToken: string, platformAdmin: PlatformAdminUser) => void;
  clearSession: () => void;
}

/** Store separado de useAuthStore (modules/auth): un PlatformAdmin no es un User de ninguna
 * empresa, su token no tiene mecanismo de refresh (expira en 8h, ver
 * apps/api/src/config/env.ts JWT_PLATFORM_ADMIN_EXPIRES_IN) -- el operador vuelve a loguearse. */
export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      platformAdmin: null,
      setSession: (accessToken, platformAdmin) => set({ accessToken, platformAdmin }),
      clearSession: () => set({ accessToken: null, platformAdmin: null }),
    }),
    { name: "erp-platform-admin-auth" }
  )
);
