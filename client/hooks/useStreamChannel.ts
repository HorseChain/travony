import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { loadAgoraRtm } from "@/lib/agoraNative";

// One realtime UI event bus per stream, carried on Agora Signaling (RTM).
// Trust boundary: every money-adjacent overlay event (gift.sent, product.*,
// viewer.count) is only honored when published by the reserved server
// identity — anything else on the channel is dropped. Missed events are
// detected as a gap in the server's dense per-channel sequence and answered
// by refetching the stream snapshot, never by replaying animations.

export interface StreamEvent {
  v: number;
  type: "gift.sent" | "product.push" | "product.clear" | "viewer.count" | "stream.state";
  seq: number;
  ts: number;
  from: string;
  data: any;
}

export interface StreamTokenBundle {
  appId: string;
  channel: string;
  uid: string;
  role: "publisher" | "subscriber";
  rtcToken: string;
  rtmToken: string;
  serverUid: string;
}

type Listener = (event: StreamEvent) => void;

export function useStreamChannel(postId: string | null, tokens: StreamTokenBundle | null) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const clientRef = useRef<any>(null);
  const lastSeqRef = useRef<number>(0);
  const aliveRef = useRef(true);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (!postId || !tokens) return;
    const rtm = loadAgoraRtm();
    if (!rtm) return; // Expo Go / web — overlays fall back to polling snapshot

    let client: any = null;
    let cancelled = false;

    const handlePayload = (publisher: string, payloadText: string) => {
      let event: StreamEvent | null = null;
      try {
        event = JSON.parse(payloadText);
      } catch {
        return;
      }
      if (!event || event.v !== 1 || typeof event.seq !== "number") return;
      // Server-only events: drop anything not signed by the server identity
      // (also drops envelope "from" spoofing — we check the RTM publisher).
      if (publisher !== tokens.serverUid || event.from !== tokens.serverUid) return;

      const last = lastSeqRef.current;
      lastSeqRef.current = event.seq;
      if (last !== 0 && event.seq !== last + 1) {
        // Missed events (reconnect / server restart): reconcile via snapshot.
        queryClient.invalidateQueries({ queryKey: ["/api/agora/streams", postId] });
        if (event.type === "gift.sent") return; // never replay stale gift animations
      }
      listenersRef.current.forEach((l) => {
        try {
          l(event as StreamEvent);
        } catch {}
      });
    };

    const connect = async () => {
      try {
        const { createAgoraRtmClient, RtmConfig } = rtm;
        client = createAgoraRtmClient(new RtmConfig(tokens.appId, tokens.uid));
        clientRef.current = client;

        client.addEventListener?.("message", (evt: any) => {
          const publisher = String(evt?.publisher ?? "");
          const payload =
            typeof evt?.message === "string"
              ? evt.message
              : evt?.message?.toString?.() ?? "";
          if (payload) handlePayload(publisher, payload);
        });
        client.addEventListener?.("tokenPrivilegeWillExpire", async () => {
          try {
            const fresh = await apiRequest("/api/agora/token", {
              method: "POST",
              body: JSON.stringify({ ridePostId: postId }),
              headers: { "Content-Type": "application/json" },
            });
            if (fresh?.rtmToken) await client.renewToken?.(fresh.rtmToken);
          } catch {}
        });

        await client.login({ token: tokens.rtmToken });
        await client.subscribe(tokens.channel, { withMessage: true, withPresence: false });
        if (!cancelled && aliveRef.current) setConnected(true);
      } catch (err) {
        console.log("[Stream] RTM connect failed:", (err as any)?.message || err);
      }
    };

    connect();

    // Background/foreground: RTM reconnects internally; on foreground we
    // reconcile state in case events were missed while suspended.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        queryClient.invalidateQueries({ queryKey: ["/api/agora/streams", postId] });
      }
    });

    return () => {
      cancelled = true;
      aliveRef.current = false;
      sub.remove();
      setConnected(false);
      const c = clientRef.current;
      clientRef.current = null;
      if (c) {
        Promise.resolve()
          .then(() => c.unsubscribe?.(tokens.channel))
          .then(() => c.logout?.())
          .then(() => c.release?.())
          .catch(() => {});
      }
    };
  }, [postId, tokens?.rtmToken]);

  return { connected, subscribe };
}
