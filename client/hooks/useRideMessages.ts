import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

import { presentLocalNotification } from "@/lib/notifications";

interface RideMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: string;
  originalMessage: string;
  translatedMessage?: string | null;
  createdAt: string;
}

function readKey(rideId: string): string {
  return `@travony_chat_read_${rideId}`;
}

/**
 * Background message polling for an active ride. Keeps the shared
 * ["/api/rides", rideId, "messages"] cache fresh even when the chat modal is
 * closed, and tracks how many messages from the other party are unread so the
 * screen can show a badge. The read marker is persisted per ride so it survives
 * screen remounts and app restarts.
 */
export function useRideMessages(params: {
  rideId: string | undefined;
  myUserId: string | undefined;
  active: boolean;
  chatOpen?: boolean;
  senderLabel?: string;
}) {
  const { rideId, myUserId, active, chatOpen = false, senderLabel } = params;
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const loadedForRide = useRef<string | undefined>(undefined);
  const notifiedIds = useRef<Set<string>>(new Set());
  const primedNotify = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!rideId) return;
    if (loadedForRide.current === rideId) return;
    loadedForRide.current = rideId;
    setLastReadAt(0);
    notifiedIds.current.clear();
    primedNotify.current = false;
    AsyncStorage.getItem(readKey(rideId))
      .then((v) => {
        if (cancelled) return;
        const parsed = v ? parseInt(v, 10) : 0;
        if (!Number.isNaN(parsed)) setLastReadAt(parsed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  const { data: messages } = useQuery<RideMessage[]>({
    queryKey: ["/api/rides", rideId, "messages"],
    enabled: !!rideId && active,
    refetchInterval: active ? 6000 : false,
  });

  const otherMessages = (messages || []).filter((m) => m.senderId !== myUserId);
  const unreadCount = otherMessages.filter(
    (m) => new Date(m.createdAt).getTime() > lastReadAt,
  ).length;

  useEffect(() => {
    if (!rideId || !active) return;
    if (!primedNotify.current) {
      primedNotify.current = true;
      otherMessages.forEach((m) => notifiedIds.current.add(m.id));
      return;
    }
    const fresh = otherMessages.filter((m) => !notifiedIds.current.has(m.id));
    fresh.forEach((m) => notifiedIds.current.add(m.id));
    if (fresh.length === 0 || chatOpen) return;
    const title = senderLabel ? `New message from ${senderLabel}` : "New message";
    fresh.forEach((m) => {
      presentLocalNotification(title, m.translatedMessage || m.originalMessage, {
        type: "ride_message",
        rideId,
      });
    });
  }, [otherMessages, chatOpen, active, rideId, senderLabel]);

  const markRead = useCallback(() => {
    if (!rideId) return;
    const latest = (messages || []).reduce((max, m) => {
      const t = new Date(m.createdAt).getTime();
      return Number.isNaN(t) ? max : Math.max(max, t);
    }, lastReadAt);
    setLastReadAt(latest);
    AsyncStorage.setItem(readKey(rideId), String(latest)).catch(() => {});
  }, [rideId, messages, lastReadAt]);

  return { messages: messages || [], unreadCount, markRead };
}
