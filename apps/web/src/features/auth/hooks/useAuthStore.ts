import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthenticatedUser } from "@erp/shared-types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthenticatedUser | null;
  setSession: (accessToken: string, refreshToken: string, user: AuthenticatedUser) => void;
  clearSession: () => void;
  hasPermission: (code: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      hasPermission: (code) => get().user?.permissions.includes(code) ?? false,
    }),
    { name: "erp-auth" }
  )
);
