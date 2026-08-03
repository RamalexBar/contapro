import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthenticatedUser } from "@erp/shared-types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthenticatedUser | null;
  hasHydrated: boolean;
  setSession: (accessToken: string, refreshToken: string, user: AuthenticatedUser) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

/**
 * Persistida en AsyncStorage (mismo criterio que apps/web usa localStorage para su store de
 * auth) -- antes era solo estado en memoria, se perdia la sesion en cada reinicio de la app.
 * `hasHydrated` distingue "todavia no se leyo el disco" de "se leyo y no hay sesion guardada"; lo
 * usa RootNavigator para no decidir la ruta inicial (Login vs Dashboard) antes de tiempo.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "erp-mobile-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ accessToken: state.accessToken, refreshToken: state.refreshToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
