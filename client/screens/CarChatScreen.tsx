/**
 * CarChatScreen — talk to a specific car.
 *
 * Mirrors the assistant chat, but the counterparty is one car's persona and
 * booking cards from this chat target that car's driver first (with automatic
 * fallback to normal broadcast if the driver doesn't take it in time).
 *
 * Every number in replies and cards is deterministic backend output; the LLM
 * only phrases small talk. A privacy toggle in the header controls whether the
 * car may greet the rider using their own coarse ride history.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuthGate } from "@/hooks/useAuthGate";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import {
  AssistantCard,
  AssistantCardData,
  AssistantPoint,
} from "@/components/assistant/AssistantCards";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "CarChat">;
type RouteProps = RouteProp<HomeStackParamList, "CarChat">;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  card?: AssistantCardData | null;
}

let msgSeq = 0;
const nextId = () => `c${Date.now()}-${msgSeq++}`;

export default function CarChatScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { requireAuth } = useAuthGate();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { vehicleId, personaName } = route.params;
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const greeted = useRef(false);

  const { data: privacy } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/me/car-chat-privacy"],
  });
  const privacyMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      apiRequest("/api/me/car-chat-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/me/car-chat-privacy"] }),
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // chat works without location; booking will ask for it
      }
    })();
  }, []);

  const pickup = currentLocation
    ? { address: "Current Location", lat: currentLocation.lat, lng: currentLocation.lng }
    : null;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const appendMessages = useCallback(
    (msgs: ChatMessage[]) => {
      setMessages((prev) => [...prev, ...msgs]);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  const sendToCar = useCallback(
    async (text: string, destination?: AssistantPoint, opts?: { silent?: boolean }) => {
      if (!requireAuth()) return;
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      const historySnapshot = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
      if (!opts?.silent) {
        appendMessages([{ id: nextId(), role: "user", text: trimmed }]);
      }
      setThinking(true);
      try {
        const res = await apiRequest(`/api/cars/${vehicleId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            pickup,
            destination,
            history: historySnapshot,
          }),
        });
        appendMessages([
          { id: nextId(), role: "assistant", text: res?.reply || "", card: res?.card || null },
        ]);
      } catch (err: any) {
        appendMessages([
          {
            id: nextId(),
            role: "assistant",
            text: err?.message || "I lost you for a second — say that again?",
            card: null,
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [appendMessages, messages, pickup, thinking, requireAuth, vehicleId]
  );

  // The car speaks first. Wait one tick for location so the greeting can carry
  // a real ETA; greet anyway if location never arrives.
  useEffect(() => {
    if (greeted.current) return;
    if (!currentLocation) {
      const t = setTimeout(() => {
        if (!greeted.current) {
          greeted.current = true;
          sendToCar("__greet__", undefined, { silent: true });
        }
      }, 2500);
      return () => clearTimeout(t);
    }
    greeted.current = true;
    sendToCar("__greet__", undefined, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation]);

  const handlers = {
    onPickPlace: (place: AssistantPoint & { label?: string }) => {
      sendToCar(place.label || place.address, {
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      });
    },
    onBooked: (_rideId: string) => {
      scrollToEnd();
    },
    onEvent: () => {},
  };

  const handleSend = () => {
    const text = input;
    setInput("");
    sendToCar(text);
  };

  const personalizationOn = privacy?.enabled !== false;
  const title = personaName || "Your car";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <ThemedText style={styles.title} numberOfLines={1}>{title}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textMuted }]}>Talking car</ThemedText>
        </View>
        <Pressable
          onPress={() => privacyMutation.mutate(!personalizationOn)}
          hitSlop={8}
          style={styles.privacyBtn}
        >
          <Ionicons
            name={personalizationOn ? "eye-outline" : "eye-off-outline"}
            size={20}
            color={personalizationOn ? theme.primary : theme.textMuted}
          />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
        >
          {messages.map((m) =>
            m.role === "user" ? (
              <Animated.View
                key={m.id}
                entering={FadeInDown.duration(250)}
                style={[styles.userBubble, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={styles.userBubbleText}>{m.text}</ThemedText>
              </Animated.View>
            ) : (
              <Animated.View key={m.id} entering={FadeInUp.duration(250)} style={styles.carBlock}>
                <View style={styles.carRow}>
                  <Ionicons name="car-sport" size={13} color={theme.primary} />
                  <ThemedText style={[styles.carLabel, { color: theme.textMuted }]}>
                    {title}
                  </ThemedText>
                </View>
                {m.text ? <ThemedText style={styles.carText}>{m.text}</ThemedText> : null}
                {m.card ? <AssistantCard card={m.card} handlers={handlers} /> : null}
              </Animated.View>
            )
          )}
          {thinking ? (
            <View style={[styles.typingBubble, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={{ color: theme.textMuted, fontSize: 13 }}>…</ThemedText>
            </View>
          ) : null}
        </ScrollView>

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              marginBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Say hi, or tell me where to…"
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!thinking}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || thinking}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: input.trim() && !thinking ? theme.primary : theme.backgroundElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={input.trim() && !thinking ? theme.textOnPrimary : theme.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  titleWrap: { flex: 1, marginLeft: Spacing.sm },
  title: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 12 },
  privacyBtn: { padding: 6 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  userBubbleText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  carBlock: { alignSelf: "stretch", maxWidth: "94%" },
  carRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  carLabel: { fontSize: 12, fontWeight: "600" },
  carText: { fontSize: 15, lineHeight: 22 },
  typingBubble: {
    alignSelf: "flex-start",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, maxHeight: 90, paddingVertical: 6 },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
