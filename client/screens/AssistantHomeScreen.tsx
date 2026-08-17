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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useLiteMode } from "@/hooks/useLiteMode";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors, Shadows } from "@/constants/theme";
import { FEATURES } from "@/constants/features";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import {
  AssistantCard,
  AssistantCardData,
  AssistantPoint,
  BookingCardData,
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
  const { requireAuth } = useAuthGate();
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

  // Voice loop: record → server STT + same deterministic executor → TTS reply.
  const { liteMode } = useLiteMode();
  const queryClient = useQueryClient();
  const voice = useVoiceAssistant();
  // What a spoken "yes" refers to. The card payload for execution is the one
  // the SERVER built (stored here when its card arrived) — a voice confirm
  // replays it exactly like a tap on the card's Confirm button.
  const voicePendingRef = useRef<{ type: string; rideId?: string } | null>(null);
  const bookingInFlightRef = useRef(false);
  const turnSeqRef = useRef(0);
  const lastBookingRef = useRef<{ msgId: string; card: BookingCardData } | null>(null);

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
      if (!requireAuth()) return;
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      turnSeqRef.current += 1; // typed turns supersede in-flight voice turns
      const mySeq = turnSeqRef.current;
      // Snapshot history BEFORE appending the new user message, then append.
      const historySnapshot = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
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
            history: historySnapshot,
            ...tp,
          }),
        });
        const staleTyped = turnSeqRef.current !== mySeq;
        const asstMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          text: res?.reply || "",
          // Same rule as voice: a superseded turn's booking card must not
          // render — its Confirm button would book a stale quote.
          card: staleTyped && res?.card?.type === "booking" ? null : res?.card || null,
        };
        appendMessages([asstMsg]);
        // Only the LATEST turn may own the pending/quote state: a stale typed
        // response must not resurrect a superseded quote for a spoken "yes".
        if (!staleTyped) {
          if (res?.card?.type === "booking") {
            lastBookingRef.current = { msgId: asstMsg.id, card: res.card };
            voicePendingRef.current = { type: "booking" };
          } else {
            // A newer non-booking turn supersedes any old quote: a later spoken
            // "yes" must never book a stale card.
            lastBookingRef.current = null;
            voicePendingRef.current = null;
          }
        }
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
    [appendMessages, messages, pickup, thinking, requireAuth]
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
      // The card's own Confirm was used — drop the voice-pending quote so a
      // later spoken "yes" can't re-book it.
      lastBookingRef.current = null;
      voicePendingRef.current = null;
      scrollToEnd();
    },
    onEvent: (intent: string, accepted: boolean, destination?: AssistantPoint) => {
      if (intent === "book_ride" && !accepted) {
        // "Not now" tapped on the card — same supersede rule.
        lastBookingRef.current = null;
        voicePendingRef.current = null;
      }
      logEvent(intent, accepted, destination);
    },
    // One booking at a time, shared between the card's Confirm button and the
    // voice-confirm path — whichever claims first wins; the loser is a no-op.
    claimBooking: () => {
      if (bookingInFlightRef.current) return false;
      bookingInFlightRef.current = true;
      return true;
    },
    releaseBooking: () => {
      bookingInFlightRef.current = false;
    },
  };

  const handleSend = () => {
    const text = input;
    setInput("");
    sendToAssistant(text);
  };

  // ---- Voice loop -----------------------------------------------------------
  const replaceCard = useCallback((msgId: string, newCard: AssistantCardData) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, card: newCard } : m)));
  }, []);

  // A spoken "yes" executes EXACTLY what a card tap would: the server-built
  // confirmPayload against the existing authenticated endpoints. The assistant
  // itself never creates or cancels rides.
  const executeVoiceAction = useCallback(
    async (action: any) => {
      if (action?.type === "confirm_booking") {
        const pendingBooking = lastBookingRef.current;
        if (!pendingBooking) {
          appendMessages([
            { id: nextId(), role: "assistant", text: "That quote is gone — ask me for a new one.", card: null },
          ]);
          return;
        }
        if (bookingInFlightRef.current) return; // one booking at a time
        bookingInFlightRef.current = true;
        // Claim the quote atomically: a concurrent tap or second "yes" now
        // finds no pending card.
        lastBookingRef.current = null;
        voicePendingRef.current = null;
        const card = pendingBooking.card;
        let paymentMethod: "cash" | "wallet" = action.paymentMethod === "wallet" ? "wallet" : "cash";
        if (paymentMethod === "wallet" && !(card.walletBalance >= card.fare)) paymentMethod = "cash";
        try {
          const ride = await apiRequest("/api/rides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...card.confirmPayload, customerId: user?.id, paymentMethod }),
          });
          const rideId = ride?.id || ride?.ride?.id;
          if (rideId) {
            // Swap the quote card for the live ride so the on-card Confirm
            // button can't double-book the same quote.
            replaceCard(pendingBooking.msgId, { type: "live_ride", rideId });
            queryClient.invalidateQueries({ queryKey: ["/api/rides?status=active"] });
            logEvent("book_ride", true, card.dropoff);
            scrollToEnd();
          }
        } catch (err: any) {
          appendMessages([
            {
              id: nextId(),
              role: "assistant",
              text: err?.message || "Booking didn't go through — try the Confirm button on the card.",
              card: null,
            },
          ]);
        } finally {
          bookingInFlightRef.current = false;
        }
      } else if (action?.type === "decline_booking") {
        const card = lastBookingRef.current?.card;
        lastBookingRef.current = null;
        voicePendingRef.current = null;
        if (card) logEvent("book_ride", false, card.dropoff);
      } else if (action?.type === "cancel_ride" && action.rideId) {
        try {
          await apiRequest(`/api/rides/${action.rideId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
          queryClient.invalidateQueries({ queryKey: [`/api/rides/${action.rideId}`] });
          queryClient.invalidateQueries({ queryKey: ["/api/rides?status=active"] });
          logEvent("cancel_ride", true);
        } catch (err: any) {
          appendMessages([
            {
              id: nextId(),
              role: "assistant",
              text: err?.message || "I couldn't cancel from here — open the ride card to cancel.",
              card: null,
            },
          ]);
        }
        voicePendingRef.current = null;
      }
    },
    [appendMessages, logEvent, queryClient, replaceCard, scrollToEnd, user?.id]
  );

  const sendVoiceTurn = useCallback(
    async (rec: { base64: string; mime: string }) => {
      turnSeqRef.current += 1;
      const mySeq = turnSeqRef.current;
      const historySnapshot = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
      try {
        const tp = timeParams();
        const res = await apiRequest("/api/voice/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: rec.base64,
            pickup,
            history: historySnapshot,
            pending: voicePendingRef.current,
            wantAudio: !liteMode, // Lite Mode: text-only replies, no TTS download
            ...tp,
          }),
        });
        const stale = turnSeqRef.current !== mySeq; // a newer turn superseded this one
        const newMsgs: ChatMessage[] = [];
        if (res?.transcript) newMsgs.push({ id: nextId(), role: "user", text: res.transcript });
        const asstMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          text: res?.reply || "",
          // A stale booking card must not be rendered: its Confirm button is a
          // live POST and the quote was superseded by a newer turn.
          card: stale && res?.card?.type === "booking" ? null : res?.card || null,
        };
        newMsgs.push(asstMsg);
        appendMessages(newMsgs);
        if (!stale) {
          voicePendingRef.current = res?.pending || null;
          if (res?.card?.type === "booking") {
            lastBookingRef.current = { msgId: asstMsg.id, card: res.card };
            voicePendingRef.current = { type: "booking" };
          }
          if (res?.action) await executeVoiceAction(res.action);
        }
        if (!stale && res?.audio) {
          await voice.playReply(res.audio, res.audioMime || "audio/mpeg");
        } else {
          voice.finishTurn();
        }
      } catch (err: any) {
        appendMessages([
          {
            id: nextId(),
            role: "assistant",
            text: err?.message || "Voice hit a snag — please try again, or type instead.",
            card: null,
          },
        ]);
        voice.finishTurn();
      }
    },
    [appendMessages, executeVoiceAction, liteMode, messages, pickup, voice]
  );

  const onMicPress = useCallback(async () => {
    if (!requireAuth()) return;
    if (voice.state === "recording") {
      const rec = await voice.stopRecording();
      if (rec) sendVoiceTurn(rec);
      return;
    }
    if (voice.state === "processing") return;
    // idle → start; speaking → barge-in (stop playback, start listening)
    await voice.startRecording();
  }, [requireAuth, sendVoiceTurn, voice]);

  const handleChip = (chip: { id: string; message: string }) => {
    if (!requireAuth()) return;
    logEvent(chip.id, true);
    sendToAssistant(chip.message);
  };

  // Guests see a real, inviting home — tapping anything opens the login sheet.
  const guestChips = [
    { id: "guest_ride", icon: "car-outline", label: "Book a ride", message: "I need a ride" },
    ...(FEATURES.coffee
      ? [{ id: "guest_coffee", icon: "cafe-outline", label: "Order coffee", message: "I'd like a coffee" }]
      : []),
    ...(FEATURES.prayerRides
      ? [{ id: "guest_prayer", icon: "moon-outline", label: "Prayer ride", message: "Take me to the mosque" }]
      : []),
    { id: "guest_places", icon: "compass-outline", label: "Places nearby", message: "What's around me?" },
  ];

  const greeting = home?.greeting || "Hello";
  const subline = home?.subline || "Where to? Ask me anything.";
  // Server chips are filtered by the client feature switchboard — long-tail
  // entry points (coffee/prayer/on-time) stay hidden while their flags are off.
  const hiddenChipIds = [
    ...(FEATURES.coffee ? [] : ["order_coffee"]),
    ...(FEATURES.prayerRides ? [] : ["prayer_ride"]),
    ...(FEATURES.onTimeArrivals ? [] : ["schedule_arrival"]),
  ];
  const serverChips = (home?.chips || []).filter((c) => !hiddenChipIds.includes(c.id));
  const chips = user?.id ? serverChips : guestChips;
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
              <Animated.View entering={FadeInDown.springify().damping(15)}>
                <Pressable
                  onPress={voice.supported ? onMicPress : undefined}
                  style={({ pressed }) => [
                    styles.heroOrb,
                    {
                      backgroundColor:
                        voice.state === "recording" ? "#E5484D22" : theme.primary + "18",
                      borderColor:
                        voice.state === "recording" ? "#E5484D55" : theme.primary + "40",
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  {voice.supported ? (
                    <Ionicons
                      name={voice.state === "recording" ? "stop" : "mic"}
                      size={34}
                      color={voice.state === "recording" ? "#E5484D" : theme.primary}
                    />
                  ) : (
                    <View style={[styles.heroOrbInner, { backgroundColor: theme.primary }]} />
                  )}
                </Pressable>
              </Animated.View>
              <Animated.View entering={FadeInDown.springify().damping(15).delay(80)}>
                <ThemedText style={styles.greeting}>{greeting}</ThemedText>
              </Animated.View>
              <Animated.View entering={FadeInDown.springify().damping(15).delay(160)}>
                <ThemedText style={[styles.subline, { color: theme.textSecondary }]}>
                  {subline}
                </ThemedText>
              </Animated.View>
              {chips.length > 0 ? (
                <Animated.View
                  entering={FadeInDown.springify().damping(15).delay(240)}
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
                          opacity: thinking ? 0.7 : 1,
                          transform: [{ scale: pressed ? 0.96 : 1 }],
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
                  entering={FadeInDown.springify().damping(16).mass(0.7)}
                  style={[styles.userBubble, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={styles.userBubbleText}>{m.text}</ThemedText>
                </Animated.View>
              ) : (
                <Animated.View
                  key={m.id}
                  entering={FadeInUp.springify().damping(16).mass(0.7)}
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
          {thinking || voice.state === "processing" ? (
            <TypingIndicator background={theme.backgroundDefault} color={theme.textMuted} />
          ) : null}
        </ScrollView>

        {/* Voice status strip */}
        {voice.state === "recording" || voice.state === "speaking" || voice.micDenied ? (
          <View style={styles.voiceStatusRow}>
            {voice.state === "recording" ? (
              <>
                <View style={styles.recordingDot} />
                <ThemedText style={[styles.voiceStatusText, { color: theme.textSecondary }]}>
                  Listening — speak any language, tap ■ to send
                </ThemedText>
              </>
            ) : voice.state === "speaking" ? (
              <ThemedText style={[styles.voiceStatusText, { color: theme.textSecondary }]}>
                Speaking — tap the mic to interrupt
              </ThemedText>
            ) : (
              <ThemedText style={[styles.voiceStatusText, { color: theme.textMuted }]}>
                Microphone unavailable — you can type instead
              </ThemedText>
            )}
          </View>
        ) : null}

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
                    opacity: thinking ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
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
            placeholder={FEATURES.coffee ? "Ask for a ride, coffee, anything…" : "Where to? Ask me anything…"}
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!thinking}
            keyboardAppearance={isDark ? "dark" : "light"}
          />
          {voice.supported ? (
            <Pressable
              onPress={onMicPress}
              disabled={voice.state === "processing"}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor:
                    voice.state === "recording"
                      ? "#E5484D"
                      : voice.state === "speaking"
                        ? theme.primary
                        : theme.backgroundSecondary,
                  opacity: pressed || voice.state === "processing" ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={
                  voice.state === "recording"
                    ? "stop"
                    : voice.state === "speaking"
                      ? "mic"
                      : "mic-outline"
                }
                size={18}
                color={
                  voice.state === "recording" || voice.state === "speaking"
                    ? Colors.light.textOnPrimary
                    : theme.text
                }
              />
            </Pressable>
          ) : null}
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
    ...Typography.h3Heavy,
    letterSpacing: -0.4,
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
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
  },
  heroOrbInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "800" as const,
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subline: {
    ...Typography.bodyLarge,
    textAlign: "center",
    marginTop: 2,
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    width: "47%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.25)",
  },
  starterCardText: {
    ...Typography.labelBold,
    flex: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: 6,
    ...Shadows.card,
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
  voiceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5484D",
  },
  voiceStatusText: {
    ...Typography.caption,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingLeft: Spacing.lg,
    paddingRight: 6,
    paddingVertical: 6,
    ...Shadows.card,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
});
