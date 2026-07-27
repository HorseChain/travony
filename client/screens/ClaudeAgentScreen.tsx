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
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import {
  AssistantCard,
  AssistantCardData,
} from "@/components/assistant/AssistantCards";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: AssistantCardData[];
  toolsUsed?: string[];
}

interface AgentContext {
  name: string;
  role: string;
  walletAed: string;
  homeAddress: string | null;
  city: string | null;
  timePeriod: string;
  activeRide: { id: string; status: string; to: string | null } | null;
  recentRides: Array<{ from: string | null; to: string | null; status: string | null }>;
  rewards: { coins: number; diamonds: number; streakDay: number; checkedInToday: boolean } | null;
  driver: any | null;
  preferences: Record<string, string>;
  sessionCount: number;
}

let seq = 0;
const nextId = () => `ag${Date.now()}-${seq++}`;

function TypingDot({ delay, color }: { delay: number; color: string }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(-5, { duration: 280 }), withTiming(0, { duration: 280 })),
        -1
      )
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

function TypingBubble({ bg, color }: { bg: string; color: string }) {
  return (
    <Animated.View entering={FadeInUp.duration(200)} style={[styles.typingBubble, { backgroundColor: bg }]}>
      <TypingDot delay={0} color={color} />
      <TypingDot delay={140} color={color} />
      <TypingDot delay={280} color={color} />
    </Animated.View>
  );
}

const TOOL_LABELS: Record<string, string> = {
  get_user_context: "Loading your profile",
  quote_ride: "Getting a ride quote",
  book_ride: "Booking your ride",
  cancel_ride: "Cancelling ride",
  get_wallet: "Checking wallet",
  get_ride_history: "Loading your trips",
  get_coffee_menu: "Opening coffee menu",
  get_rewards_info: "Checking your rewards",
  do_daily_checkin: "Checking in",
  go_driver_online: "Going online",
  go_driver_offline: "Going offline",
  get_driver_info: "Loading driver info",
  remember_preference: "Saving preference",
};

const STARTER_CHIPS = [
  { id: "book", icon: "car-outline" as const, label: "Book a ride", message: "I need a ride" },
  { id: "wallet", icon: "wallet-outline" as const, label: "My wallet", message: "Show my wallet balance" },
  { id: "coffee", icon: "cafe-outline" as const, label: "Order coffee", message: "Show me the coffee menu" },
  { id: "rewards", icon: "gift-outline" as const, label: "My rewards", message: "Check my coins and rewards" },
];

export default function ClaudeAgentScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [activeToolLabel, setActiveToolLabel] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const shownActiveRide = useRef(false);

  const { data: ctx } = useQuery<AgentContext>({
    queryKey: ["/api/agent/context"],
    enabled: !!user?.id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (ctx?.activeRide?.id && !shownActiveRide.current) {
      shownActiveRide.current = true;
      append([{
        id: nextId(),
        role: "assistant",
        text: "You have a ride in progress:",
        cards: [{ type: "live_ride", rideId: ctx.activeRide.id }],
      }]);
    }
  }, [ctx?.activeRide?.id]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const append = useCallback((msgs: ConversationMessage[]) => {
    setMessages((prev) => [...prev, ...msgs]);
    scrollToEnd();
  }, [scrollToEnd]);

  const historyForServer = (msgs: ConversationMessage[]) =>
    msgs.map((m) => ({ role: m.role, content: m.text }));

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      const userMsg: ConversationMessage = { id: nextId(), role: "user", text: trimmed };
      const updated = [...messages, userMsg];
      setMessages(updated);
      scrollToEnd();
      setThinking(true);
      setActiveToolLabel("Working on it");

      try {
        const res = await apiRequest("/api/agent/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForServer(updated),
            location,
          }),
        });

        const assistantMsg: ConversationMessage = {
          id: nextId(),
          role: "assistant",
          text: res?.reply || "",
          cards: Array.isArray(res?.cards) ? res.cards : (res?.card ? [res.card] : []),
          toolsUsed: res?.toolsUsed || [],
        };
        setMessages((prev) => [...prev, assistantMsg]);
        scrollToEnd();
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: err?.message || "Something went wrong — please try again.",
            cards: [],
          },
        ]);
        scrollToEnd();
      } finally {
        setThinking(false);
        setActiveToolLabel(null);
      }
    },
    [messages, thinking, location, scrollToEnd]
  );

  const handleSend = () => {
    const text = input;
    setInput("");
    sendMessage(text);
  };

  const conversationStarted = messages.length > 0;
  const firstName = ctx?.name?.split(" ")[0] || user?.name?.split(" ")[0] || "there";

  const handlers = {
    onPickPlace: (place: any) => {
      sendMessage(`Take me to ${place.label || place.address}`);
    },
    onBooked: (_rideId: string) => scrollToEnd(),
    onEvent: (_intent: string, _accepted: boolean) => {},
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.aiBadge, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={12} color="#fff" />
          </View>
          <ThemedText style={styles.headerTitle}>Travony AI</ThemedText>
        </View>
        <View style={{ width: 40 }} />
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
            !conversationStarted && styles.scrollContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          onContentSizeChange={scrollToEnd}
        >
          {!conversationStarted ? (
            <View style={styles.emptyState}>
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={[styles.orbOuter, { backgroundColor: theme.primary + "18" }]}>
                  <View style={[styles.orbInner, { backgroundColor: theme.primary }]}>
                    <Ionicons name="sparkles" size={22} color="#fff" />
                  </View>
                </View>
              </Animated.View>
              <Animated.View entering={FadeInDown.duration(400).delay(80)}>
                <ThemedText style={styles.greeting}>
                  {ctx ? `Hi ${firstName}, I'm your AI agent` : "Travony AI"}
                </ThemedText>
              </Animated.View>
              <Animated.View entering={FadeInDown.duration(400).delay(160)}>
                <ThemedText style={[styles.subline, { color: theme.textSecondary }]}>
                  I can book rides, check your wallet, order coffee, manage your driver status, and more — just ask.
                </ThemedText>
              </Animated.View>
              <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.starterGrid}>
                {STARTER_CHIPS.map((chip) => (
                  <Pressable
                    key={chip.id}
                    onPress={() => sendMessage(chip.message)}
                    disabled={thinking}
                    style={({ pressed }) => [
                      styles.starterCard,
                      { backgroundColor: theme.backgroundDefault, opacity: pressed || thinking ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name={chip.icon} size={18} color={theme.primary} />
                    <ThemedText style={styles.starterLabel} numberOfLines={2}>
                      {chip.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <Animated.View
                  key={m.id}
                  entering={FadeInDown.duration(220)}
                  style={[styles.userBubble, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={styles.userText}>{m.text}</ThemedText>
                </Animated.View>
              ) : (
                <Animated.View
                  key={m.id}
                  entering={FadeInUp.duration(220)}
                  style={styles.assistantBlock}
                >
                  <View style={styles.agentLabel}>
                    <View style={[styles.aiBadgeSmall, { backgroundColor: theme.primary }]}>
                      <Ionicons name="sparkles" size={9} color="#fff" />
                    </View>
                    <ThemedText style={[styles.agentName, { color: theme.textMuted }]}>
                      Travony AI
                    </ThemedText>
                    {m.toolsUsed && m.toolsUsed.length > 0 ? (
                      <ThemedText style={[styles.toolPill, { color: theme.textMuted, backgroundColor: theme.backgroundSecondary }]}>
                        {m.toolsUsed.length} action{m.toolsUsed.length > 1 ? "s" : ""}
                      </ThemedText>
                    ) : null}
                  </View>
                  {m.text ? <ThemedText style={styles.assistantText}>{m.text}</ThemedText> : null}
                  {m.cards?.map((card, ci) => (
                    <AssistantCard key={ci} card={card} handlers={handlers} />
                  ))}
                </Animated.View>
              )
            )
          )}

          {thinking ? (
            <Animated.View entering={FadeInUp.duration(200)} style={styles.assistantBlock}>
              <View style={styles.agentLabel}>
                <View style={[styles.aiBadgeSmall, { backgroundColor: theme.primary }]}>
                  <Ionicons name="sparkles" size={9} color="#fff" />
                </View>
                <ThemedText style={[styles.agentName, { color: theme.textMuted }]}>Travony AI</ThemedText>
                {activeToolLabel ? (
                  <ThemedText style={[styles.toolPill, { color: theme.primary, backgroundColor: theme.primary + "18" }]}>
                    {activeToolLabel}
                  </ThemedText>
                ) : null}
              </View>
              <TypingBubble bg={theme.backgroundDefault} color={theme.textMuted} />
            </Animated.View>
          ) : null}
        </ScrollView>

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
            placeholder="Ask anything…"
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!thinking}
            keyboardAppearance={isDark ? "dark" : "light"}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || thinking}
            style={({ pressed }) => [
              styles.sendBtn,
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
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  aiBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBadgeSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  orbOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  orbInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    ...Typography.h3,
    textAlign: "center",
  },
  subline: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  starterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
    width: "100%",
  },
  starterCard: {
    width: "47%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    minHeight: 80,
    justifyContent: "center",
  },
  starterLabel: {
    ...Typography.bodySmall,
    fontWeight: "500",
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  userText: {
    ...Typography.body,
    color: "#fff",
  },
  assistantBlock: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    gap: Spacing.xs,
  },
  agentLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  agentName: {
    ...Typography.small,
    fontWeight: "600",
  },
  toolPill: {
    ...Typography.small,
    fontSize: 10,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  assistantText: {
    ...Typography.body,
    lineHeight: 22,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
