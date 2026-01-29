import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "@travony_auth";
const USER_KEY = "@travony_user";

export interface AuthUser {
  id: string;
  email?: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: "customer" | "driver" | "admin" | "fleet_owner";
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

let globalAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

const listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(globalAuthState);

  useEffect(() => {
    const listener = () => setState({ ...globalAuthState });
    listeners.add(listener);
    
    if (globalAuthState.isLoading) {
      loadAuthState();
    }
    
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const loadAuthState = async () => {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson) as AuthUser;
        globalAuthState = {
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        };
      } else {
        globalAuthState = {
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        };
      }
    } catch (error) {
      globalAuthState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    }
    notifyListeners();
  };

  const login = useCallback(async (user: AuthUser, token: string) => {
    try {
      console.log("Login called with user:", JSON.stringify(user));
      console.log("Login called with token:", token ? "present" : "missing");
      
      // Validate user object to prevent crashes
      if (!user || typeof user !== 'object') {
        console.error("Invalid user object:", user);
        throw new Error("Invalid user data received");
      }
      
      // Ensure required fields exist
      const safeUser: AuthUser = {
        id: String(user.id || ""),
        name: String(user.name || "User"),
        email: String(user.email || ""),
        phone: user.phone ? String(user.phone) : undefined,
        avatar: user.avatar ? String(user.avatar) : undefined,
        role: user.role || "customer",
      };
      
      console.log("Safe user object:", JSON.stringify(safeUser));
      
      await Promise.all([
        AsyncStorage.setItem(AUTH_KEY, token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(safeUser)),
      ]);
      
      console.log("AsyncStorage saved successfully");
      
      globalAuthState = {
        user: safeUser,
        token,
        isAuthenticated: true,
        isLoading: false,
      };
      
      console.log("Global auth state updated, notifying listeners");
      notifyListeners();
    } catch (error) {
      console.error("Failed to save auth state:", error);
      // Still set authenticated in memory even if storage fails
      globalAuthState = {
        user: user,
        token,
        isAuthenticated: true,
        isLoading: false,
      };
      notifyListeners();
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
      globalAuthState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
      notifyListeners();
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    }
  }, []);

  const updateUser = useCallback(async (userData: Partial<AuthUser>) => {
    if (globalAuthState.user) {
      const updatedUser = { ...globalAuthState.user, ...userData };
      try {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        globalAuthState = { ...globalAuthState, user: updatedUser };
        notifyListeners();
      } catch (error) {
        console.error("Failed to update user:", error);
      }
    }
  }, []);

  return {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    logout,
    updateUser,
  };
}
