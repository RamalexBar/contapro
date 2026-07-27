import { create } from "zustand";
import type { AuthenticatedUser } from "@erp/shared-types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthenticatedUser | null;
  setSession: (accessToken: string, refreshToken: string, user: AuthenticatedUser) => void;
  clearSession: () => void;
}

/**
 * Scaffold: estado solo en memoria. Para persistir sesion entre reinicios de la app se debe
 * agregar el middleware `persist` de zustand con un storage de AsyncStorage
 * (@react-native-async-storage/async-storage), igual que apps/web usa localStorage.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
  clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
}));
