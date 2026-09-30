import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

type IncomingRequest = {
  id: string;
  riderName: string;
  expiresAt: string;
};

/** Mounted above the driver tabs so requests reach the driver during a ride,
 * on another tab, or while the Home screen is behind a stack screen. */
export default function DriverGoLiveRequests({
  enabled,
  onAccepted,
}: {
  enabled: boolean;
  onAccepted: (postId: string) => void;
}) {
  const queryClient = useQueryClient();
  const handled = useRef(new Set<string>());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data } = useQuery<{ requests: IncomingRequest[] }>({
    queryKey: ["/api/go-live-requests/incoming"],
    enabled,
    refetchInterval: 3000,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const request = data?.requests.find(
    (item) => !handled.current.has(item.id) && new Date(item.expiresAt).getTime() > now,
  );
  const remaining = request
    ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - now) / 1000))
    : 0;

  const respond = async (decision: "accept" | "decline") => {
    if (!request || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(`/api/go-live-requests/${request.id}/${decision}`, { method: "PATCH" });
      handled.current.add(request.id);
      await queryClient.invalidateQueries({ queryKey: ["/api/go-live-requests/incoming"] });
      if (decision === "accept" && result?.postId) onAccepted(result.postId);
    } catch {
      setError("Could not respond. Please try again before the request expires.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => respond("decline")}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Go Live Request</Text>
          <Text style={styles.body}>{request?.riderName || "A rider"} wants you to broadcast.</Text>
          <Text style={styles.timer}>{remaining}s to respond</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.secondary} disabled={busy} onPress={() => respond("decline")}>
              <Text style={styles.secondaryText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.primary} disabled={busy} onPress={() => respond("accept")}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Go Live</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.65)" },
  card: { backgroundColor: "#17151d", borderRadius: 22, padding: 24, gap: 14 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  body: { color: "#e5e2e8", fontSize: 16 },
  timer: { color: "#ff695f", fontSize: 15, fontWeight: "600" },
  error: { color: "#ff695f", fontSize: 14 },
  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  secondary: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: "#333039", alignItems: "center" },
  primary: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: "#e92e32", alignItems: "center" },
  secondaryText: { color: "#fff", fontWeight: "700" },
  primaryText: { color: "#fff", fontWeight: "700" },
});