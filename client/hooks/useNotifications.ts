import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { apiRequest } from "@/lib/query-client";
import {
  ensureNotificationsSetup,
  presentLocalNotification,
} from "@/lib/notifications";

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  urgency: "low" | "normal" | "high";
  readAt: string | null;
  createdAt: string;
}

interface InboxResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

/** Inbox data + actions for the Notifications screen and unread badges. */
export function useNotificationInbox() {
  const { user } = useAuth();
  const { liteMode } = useLiteMode();
  const queryClient = useQueryClient();

  const query = useQuery<InboxResponse>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: litePollMs(30000, liteMode),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      apiRequest("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
    markAllRead,
  };
}

/**
 * App-wide alerting: fires a local notification (banner + sound) whenever a
 * new unread inbox item arrives. Mounted once per tab navigator. Renders
 * nothing — side effects only. Primes on first data so users aren't blasted
 * with historical items at app start.
 */
export function useNotificationAlerts() {
  const { user } = useAuth();
  const { liteMode } = useLiteMode();

  const { data, dataUpdatedAt } = useQuery<InboxResponse>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: litePollMs(30000, liteMode),
  });

  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    ensureNotificationsSetup();
  }, []);

  useEffect(() => {
    // Reset priming on any account change (login, logout, or account switch)
    // so one account's unread items never fire alerts for another.
    const uid = user?.id ?? null;
    if (uid !== lastUserId.current) {
      lastUserId.current = uid;
      primed.current = false;
      seen.current.clear();
    }
    if (!user) return;
    if (!dataUpdatedAt || !data) return;

    const unread = data.notifications.filter((n) => !n.readAt);
    if (!primed.current) {
      unread.forEach((n) => seen.current.add(n.id));
      primed.current = true;
      return;
    }
    for (const n of unread) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      presentLocalNotification(n.title, n.body, n.data ?? undefined).catch(
        () => {},
      );
    }
  }, [user?.id, dataUpdatedAt, data]);
}
