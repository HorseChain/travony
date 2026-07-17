import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/hooks/useAuth";

export type LoginSheetMode = "login" | "signup";

interface AuthGateContextValue {
  sheetVisible: boolean;
  sheetMode: LoginSheetMode;
  openLoginSheet: (mode?: LoginSheetMode) => void;
  closeLoginSheet: () => void;
  /**
   * Returns true when the user is signed in. When they are not, the
   * TikTok-style login sheet is opened and false is returned — callers
   * should simply stop the action.
   */
  requireAuth: () => boolean;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<LoginSheetMode>("login");

  const openLoginSheet = useCallback((mode: LoginSheetMode = "login") => {
    setSheetMode(mode);
    setSheetVisible(true);
  }, []);

  const closeLoginSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const requireAuth = useCallback((): boolean => {
    if (isAuthenticated) return true;
    setSheetMode("login");
    setSheetVisible(true);
    return false;
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({ sheetVisible, sheetMode, openLoginSheet, closeLoginSheet, requireAuth }),
    [sheetVisible, sheetMode, openLoginSheet, closeLoginSheet, requireAuth],
  );

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error("useAuthGate must be used within an AuthGateProvider");
  }
  return ctx;
}
