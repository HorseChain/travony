import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "@travony_auth";

export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    // Fallback to production URL for Expo Go
    host = "travony.replit.app";
  }

  // Remove protocol if already present
  if (host.startsWith("http://") || host.startsWith("https://")) {
    host = host.replace(/^https?:\/\//, "");
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Try to extract clean message from JSON error responses
    try {
      const errorData = JSON.parse(text);
      // Extract just the message, not the code or raw JSON
      const message = errorData.message || errorData.error || text;
      throw new Error(message);
    } catch (parseError) {
      // If not JSON, use the raw text but make it cleaner
      if (text.includes('"message"')) {
        const match = text.match(/"message"\s*:\s*"([^"]+)"/);
        if (match) {
          throw new Error(match[1]);
        }
      }
      throw new Error(text || "Something went wrong. Please try again.");
    }
  }
}

export async function apiRequest(
  route: string,
  options?: RequestInit,
): Promise<any> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  
  const token = await getAuthToken();
  const headers: HeadersInit = {
    ...options?.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  const text = await res.text();
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const path = queryKey.filter(k => k !== null && k !== undefined).join("/");
    const url = new URL(path, baseUrl);
    
    const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
