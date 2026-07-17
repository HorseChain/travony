import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import {
  AssistantCard,
  AssistantCardData,
  AssistantPoint,
} from "@/components/assistant/AssistantCards";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "Home">;
type RouteProps = RouteProp<HomeStackParamList, "Home">;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  card?: AssistantCardData | null;
}

interface HomeData {
  greeting: string;
  subline: string;
  chips: { id: string; label: string; icon: string; message: string }[];
  activeRideId: string | null;
  hasHome: boolean;
  hasWork: boolean;
}

let msgSeq = 0;
const nextId = () => `m${Date.now()}-${msgSeq++}`;

function timeParams() {
  const now = new Date();
  return { hour: now.getHours(), dow: now.getDay(), tzOffset: -now.getTimezoneOffset() };
}

export default function AssistantHomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const shownActiveRide = useRef(false);
  const handledParamsKey = useRef<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // On iOS the keyboard covers the tab bar, so the input bar's tab-bar margin
  // would otherwise float it above the keyboard by a tab bar's height.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const t = timeParams();
  const { data: home } = useQuery<HomeData>({
    queryKey: [`/api/assistant/home?hour=${t.hour}&dow=${t.dow}&tzOffset=${t.tzOffset}`],
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Quiet location primer — the assistant quotes rides from where you are.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // location stays null; the assistant will offer the map instead
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

  const logEvent = useCallback((intent: string, accepted: boolean, destination?: AssistantPoint) => {
    const tp = timeParams();
    apiRequest("/api/assistant/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, accepted, destination, ...tp }),
    }).catch(() => {});
  }, []);

  const sendToAssistant = useCallback(
    async (text: string, destination?: AssistantPoint, pickupOverride?: AssistantPoint | null) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;
      appendMessages([{ id: nextId(), role: "user", text: trimmed }]);
      setThinking(true);
      try {
        const tp = timeParams();
        const res = await apiRequest("/api/assistant/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            pickup: pickupOverride !== undefined ? pickupOverride : pickup,
            destination,
            ...tp,
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
            text: err?.message || "I hit a snag — please try that again.",
            card: null,
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [appendMessages, pickup, thinking]
  );

  // Ride handoffs from the classic flows: SelectLocation and "Book Again" both
  // land on Home with a chosen dropoff (and sometimes pickup). The assistant
  // answers with a booking card instead of the old map sheet.
  useEffect(() => {
    const sel = route.params?.selectedLocation;
    if (!sel || sel.type !== "dropoff") return;
    const key = `${sel.address}|${sel.lat}|${sel.lng}`;
    if (handledParamsKey.current === key) return;
    handledParamsKey.current = key;
    const selPickup = route.params?.selectedPickup;
    const pickupPoint = selPickup
      ? { address: selPickup.address, lat: selPickup.lat, lng: selPickup.lng }
      : pickup;
    sendToAssistant(
      `Take me to ${sel.address}`,
      { address: sel.address, lat: sel.lat, lng: sel.lng },
      pickupPoint
    );
    navigation.setParams({ selectedLocation: undefined, selectedPickup: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.selectedLocation, route.params?.selectedPickup]);

  // Surface an in-progress ride as the first thing in the conversation.
  useEffect(() => {
    if (home?.activeRideId && !shownActiveRide.current) {
      shownActiveRide.current = true;
      appendMessages([
        {
          id: nextId(),
          role: "assistant",
          text: "You have a ride in progress:",
          card: { type: "live_ride", rideId: home.activeRideId },
        },
      ]);
    }
  }, [home?.activeRideId, appendMessages]);

  const handlers = {
    onPickPlace: (place: AssistantPoint & { label?: string }) => {
      sendToAssistant(place.label || place.address, {
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      });
    },
    onBooked: (_rideId: string) => {
      scrollToEnd();
    },
    onEvent: logEvent,
  };

  const handleSend = () => {
    const text = input;
    setInput("");
    sendToAssistant(text);
  };

  const handleChip = (chip: { id: string; message: string }) => {
    logEvent(chip.id, true);
    sendToAssistant(chip.message);
  };

  const greeting = home?.greeting || "Hello";
  const subline = home?.subline || "Where to? Ask me anything.";
  const chips = home?.chips || [];
  const conversationStarted = messages.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Top bar: brand + map escape hatch */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandDot, { backgroundColor: theme.primary }]} />
          <ThemedText style={styles.brandText}>Travony</ThemedText>
        </View>
        <Pressable
          onPress={() => navigation.navigate("MapHome", {})}
          style={({ pressed }) => [
            styles.mapButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="map-outline" size={16} color={theme.text} />
          <ThemedText style={styles.mapButtonText}>Map</ThemedText>
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
          contentContainerStyle={[
            styles.scrollContent,
            !conversationStarted ? styles.scrollContentEmpty : null,
          ]}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          onContentSizeChange={scrollToEnd}
        >
          {!conversationStarted ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.greeting}>{greeting}</ThemedText>
              <ThemedText style={[styles.subline, { color: theme.textSecondary }]}>
                {subline}
              </ThemedText>
            </View>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <View key={m.id} style={[styles.userBubble, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.userBubbleText}>{m.text}</ThemedText>
                </View>
              ) : (
                <View key={m.id} style={styles.assistantBlock}>
                  {m.text ? <ThemedText style={styles.assistantText}>{m.text}</ThemedText> : null}
                  {m.card ? <AssistantCard card={m.card} handlers={handlers} /> : null}
                </View>
              )
            )
          )}
          {thinking ? (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText style={[styles.thinkingText, { color: theme.textMuted }]}>
                Thinking…
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        {/* Adaptive chips */}
        {chips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {chips.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={() => handleChip(chip)}
                disabled={thinking}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                    opacity: pressed || thinking ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name={chip.icon as any} size={14} color={theme.primary} />
                <ThemedText style={styles.chipText}>{chip.label}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              marginBottom: keyboardVisible ? Spacing.sm : tabBarHeight + Spacing.sm,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Ask for a ride, coffee, anything…"
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!thinking}
            keyboardAppearance={isDark ? "dark" : "light"}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || thinking}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: input.trim() && !thinking ? theme.primary : theme.backgroundSecondary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-up" size={18} color={Colors.light.textOnPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandText: {
    ...Typography.h3,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  mapButtonText: {
    ...Typography.smallBold,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing["4xl"],
  },
  greeting: {
    ...Typography.h1,
    textAlign: "center",
  },
  subline: {
    ...Typography.body,
    textAlign: "center",
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.xs,
  },
  userBubbleText: {
    ...Typography.body,
    color: Colors.light.textOnPrimary,
  },
  assistantBlock: {
    alignSelf: "stretch",
    maxWidth: "100%",
  },
  assistantText: {
    ...Typography.body,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  thinkingText: {
    ...Typography.small,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.smallMedium,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
});
