import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "@travony_auth";

export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    host = "travony.replit.app";
  }

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

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.code === "NETWORK_ERROR";
  }

  get isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR";
  }

  get isServerError(): boolean {
    return this.statusCode >= 500;
  }

  get userMessage(): string {
    return USER_FRIENDLY_MESSAGES[this.code] || this.message;
  }
}

const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Unable to connect. Please check your internet and try again.",
  AUTHENTICATION_ERROR: "Please sign in to continue.",
  AUTHORIZATION_ERROR: "You don't have permission for this action.",
  NOT_FOUND: "The requested item was not found.",
  VALIDATION_ERROR: "Please check your input and try again.",
  CONFLICT: "This action conflicts with existing data.",
  RATE_LIMIT: "Too many requests. Please wait a moment and try again.",
  EXTERNAL_SERVICE_ERROR: "A service is temporarily unavailable. Please try again shortly.",
  PAYMENT_ERROR: "Payment could not be processed. Please try again.",
  BLOCKCHAIN_ERROR: "Blockchain verification is temporarily unavailable.",
  RIDE_ERROR: "There was an issue with the ride request.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage;
  }
  if (error instanceof TypeError && error.message === "Network request failed") {
    return USER_FRIENDLY_MESSAGES.NETWORK_ERROR;
  }
  if (error instanceof Error) {
    return error.message || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;

    try {
      const errorData = JSON.parse(text);
      throw new ApiError(
        errorData.message || errorData.error || "Request failed",
        errorData.code || "UNKNOWN",
        res.status,
        errorData.details
      );
    } catch (parseError) {
      if (parseError instanceof ApiError) throw parseError;
      throw new ApiError(
        text || "Something went wrong. Please try again.",
        "UNKNOWN",
        res.status
      );
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

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (networkError) {
    throw new ApiError(
      "Unable to connect to the server",
      "NETWORK_ERROR",
      0
    );
  }

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

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        credentials: "include",
      });
    } catch (networkError) {
      throw new ApiError(
        "Unable to connect to the server",
        "NETWORK_ERROR",
        0
      );
    }

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
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.isAuthError || error.isValidation) return false;
          if (error.isNetworkError || error.isServerError) return failureCount < 2;
        }
        return false;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
