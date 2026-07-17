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
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
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

function TypingDot({ delay, color }: { delay: number; color: string }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 280 }),
          withTiming(0, { duration: 280 })
        ),
        -1
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  return <Animated.View style={[styles.typingDot, { backgroundColor: color }, style]} />;
}

function TypingIndicator({ background, color }: { background: string; color: string }) {
  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={[styles.typingBubble, { backgroundColor: background }]}
    >
      <TypingDot delay={0} color={color} />
      <TypingDot delay={140} color={color} />
      <TypingDot delay={280} color={color} />
    </Animated.View>
  );
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
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={[styles.heroOrb, { backgroundColor: theme.primary + "18" }]}>
                  <View style={[styles.heroOrbInner, { backgroundColor: theme.primary }]} />
                </View>
              </Animated.View>
              <Animated.View entering={FadeInDown.duration(400).delay(80)}>
                <ThemedText style={styles.greeting}>{greeting}</ThemedText>
              </Animated.View>
              <Animated.View entering={FadeInDown.duration(400).delay(160)}>
                <ThemedText style={[styles.subline, { color: theme.textSecondary }]}>
                  {subline}
                </ThemedText>
              </Animated.View>
              {chips.length > 0 ? (
                <Animated.View
                  entering={FadeInDown.duration(400).delay(240)}
                  style={styles.starterGrid}
                >
                  {chips.slice(0, 4).map((chip) => (
                    <Pressable
                      key={chip.id}
                      onPress={() => handleChip(chip)}
                      disabled={thinking}
                      style={({ pressed }) => [
                        styles.starterCard,
                        {
                          backgroundColor: theme.backgroundDefault,
                          opacity: pressed || thinking ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Ionicons name={chip.icon as any} size={18} color={theme.primary} />
                      <ThemedText style={styles.starterCardText} numberOfLines={2}>
                        {chip.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}
            </View>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <Animated.View
                  key={m.id}
                  entering={FadeInDown.duration(250)}
                  style={[styles.userBubble, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={styles.userBubbleText}>{m.text}</ThemedText>
                </Animated.View>
              ) : (
                <Animated.View
                  key={m.id}
                  entering={FadeInUp.duration(250)}
                  style={styles.assistantBlock}
                >
                  <View style={styles.assistantRow}>
                    <View style={[styles.assistantDot, { backgroundColor: theme.primary }]} />
                    <ThemedText style={[styles.assistantLabel, { color: theme.textMuted }]}>
                      Travony
                    </ThemedText>
                  </View>
                  {m.text ? <ThemedText style={styles.assistantText}>{m.text}</ThemedText> : null}
                  {m.card ? <AssistantCard card={m.card} handlers={handlers} /> : null}
                </Animated.View>
              )
            )
          )}
          {thinking ? (
            <TypingIndicator background={theme.backgroundDefault} color={theme.textMuted} />
          ) : null}
        </ScrollView>

        {/* Adaptive chips */}
        {conversationStarted && chips.length > 0 ? (
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
  heroOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroOrbInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  greeting: {
    ...Typography.h1,
    textAlign: "center",
  },
  subline: {
    ...Typography.body,
    textAlign: "center",
  },
  starterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  starterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    width: "47%",
  },
  starterCardText: {
    ...Typography.smallMedium,
    flex: 1,
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
  assistantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  assistantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  assistantLabel: {
    ...Typography.captionBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  assistantText: {
    ...Typography.body,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.xs,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
