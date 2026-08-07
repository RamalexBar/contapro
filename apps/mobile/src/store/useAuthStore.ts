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
  /** Item 42 de docs/ALCANCE.md: mismo patron que apps/web/src/features/auth/hooks/useAuthStore.ts
   * -- gatea las acciones de Caja/Inventario (no todos los roles que usen el movil en el futuro
   * tienen por que tener todos los permisos de CAJERO). */
  hasPermission: (code: string) => boolean;
}

/**
 * Persistida en AsyncStorage (mismo criterio que apps/web usa localStorage para su store de
 * auth) -- antes era solo estado en memoria, se perdia la sesion en cada reinicio de la app.
 * `hasHydrated` distingue "todavia no se leyo el disco" de "se leyo y no hay sesion guardada"; lo
 * usa RootNavigator para no decidir la ruta inicial (Login vs Dashboard) antes de tiempo.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      hasPermission: (code) => get().user?.permissions.includes(code) ?? false,
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
