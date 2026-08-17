import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { apiRequest } from "@/lib/query-client";
import { FEATURES } from "@/constants/features";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

// ============================================================================
// Assistant cards — the interactive layer of the AI home. Every number shown
// here came from the deterministic backend; the Confirm button is the ONLY
// path that creates a ride, and it hits the existing POST /api/rides endpoint.
// ============================================================================

export interface AssistantPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface BookingCardData {
  type: "booking";
  pickup: AssistantPoint;
  dropoff: AssistantPoint;
  vehicleType: string;
  regionCode: string;
  currency: string;
  fare: number;
  platformFee: number;
  driverEarnings: number;
  distanceKm: number;
  durationMin: number;
  surgeMultiplier: number;
  priceExplanation: string[];
  walletBalance: number;
  confirmPayload: Record<string, any>;
}

export type AssistantCardData =
  | BookingCardData
  | { type: "places"; places: Array<AssistantPoint & { label: string; icon: string; reason: string }>; mapOption?: boolean }
  | { type: "action"; action: string; label: string }
  | { type: "live_ride"; rideId: string; status?: string }
  | { type: "wallet"; balance: string; currency: string; transactions: Array<{ id: string; type: string; amount: string; currency: string; description: string; status: string; createdAt: string }> }
  | { type: "rides"; rides: Array<{ id: string; pickupAddress: string; dropoffAddress: string; fare: string; currency: string; status: string; createdAt: string; hasBlockchainProof: boolean }> }
  | { type: "coffee"; items: Array<{ id: string; name: string; basePrice: number; currency: string; description: string; category: string }>; orderId?: string; status?: string }
  | { type: "prayer"; subscriptions: Array<{ id: string; mosqueName: string; prayers: string; status: string }> }
  | { type: "arrival"; arrivals: Array<{ id: string; label: string; destAddress: string; mode: string; arriveTimeLocal: string | null; arriveAtUtc: string | null; status: string }> }
  | { type: "rewards"; coins: number; diamonds: number; streakDay: number; checkedInToday: boolean; nextCheckInCoins: number; cashableAed: string }
  | { type: "missions"; missions: Array<{ key: string; name: string; coins: number; completed: boolean }> }
  | { type: "earnings"; days: number; totalAed: string; rideCount: number; rides: Array<{ to: string; earnings: string; date: string }> }
  | { type: "ladder"; targetName: string; totalContributed: number; currency: string; progressPercent: number; qualified: boolean; agentMessage: string }
  | { type: "pending_rides"; rides: Array<{ id: string; pickup: string; dropoff: string; fare: string; distance: string | null }> }
  | { type: "coffee_orders"; orders: Array<{ id: string; item: string; size: string | null; type: string | null; totalAmount: string | null; deliveryAddress: string | null }> }
  | { type: "trending"; routes: Array<{ label: string; city: string | null; rising: boolean }>; terms: Array<{ label: string }> };

export interface AssistantCardHandlers {
  onPickPlace: (place: AssistantPoint & { label?: string }) => void;
  onBooked: (rideId: string) => void;
  onEvent: (intent: string, accepted: boolean, destination?: AssistantPoint) => void;
  /**
   * Shared booking claim between the card's Confirm button and the parent's
   * voice-confirm path. Returns false when another booking attempt is already
   * in flight — the caller must NOT start its own request. Call releaseBooking
   * only after a claimed attempt fails (success keeps the claim consumed).
   */
  claimBooking?: () => boolean;
  releaseBooking?: () => void;
}

function CardShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

function RowButton({
  label,
  icon,
  onPress,
  tone = "default",
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  tone?: "default" | "primary";
}) {
  const { theme } = useTheme();
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowButton,
        {
          backgroundColor: primary ? theme.primary : theme.backgroundDefault,
          borderColor: primary ? theme.primary : theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon as any} size={16} color={primary ? theme.textOnPrimary : theme.primary} />
      ) : null}
      <ThemedText style={[styles.rowButtonText, { color: primary ? theme.textOnPrimary : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Booking card — compact quote → expandable breakdown → explicit Confirm.
// ---------------------------------------------------------------------------
function BookingCard({ card, handlers }: { card: BookingCardData; handlers: AssistantCardHandlers }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [declined, setDeclined] = useState(false);
  const [bookedRideId, setBookedRideId] = useState<string | null>(null);

  const walletCoversFare = card.walletBalance >= card.fare;

  const bookMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...card.confirmPayload,
          customerId: user?.id,
          paymentMethod,
        }),
      }),
    onSuccess: (ride: any) => {
      const rideId = ride?.id || ride?.ride?.id;
      setBookedRideId(rideId);
      queryClient.invalidateQueries({ queryKey: ["/api/rides?status=active"] });
      handlers.onEvent("book_ride", true, card.dropoff);
      if (rideId) handlers.onBooked(rideId);
    },
    onError: () => {
      handlers.releaseBooking?.();
    },
  });

  const confirmBooking = () => {
    if (bookMutation.isPending) return;
    // Refuse to start when a voice "yes" already claimed this quote.
    if (handlers.claimBooking && !handlers.claimBooking()) return;
    bookMutation.mutate();
  };

  if (bookedRideId) {
    return <LiveRideCard card={{ type: "live_ride", rideId: bookedRideId }} />;
  }

  return (
    <CardShell>
      <View style={styles.bookingHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
          <Ionicons name="car-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.bookingFare}>
            {card.currency} {card.fare.toFixed(2)}
          </ThemedText>
          <ThemedText style={[styles.bookingMeta, { color: theme.textSecondary }]}>
            {card.distanceKm} km · ~{card.durationMin} min
            {card.surgeMultiplier > 1.05 ? ` · ${card.surgeMultiplier}x demand` : ""}
          </ThemedText>
        </View>
      </View>

      <View style={styles.routeRow}>
        <Ionicons name="radio-button-on" size={12} color={theme.primary} />
        <ThemedText style={[styles.routeText, { color: theme.textSecondary }]} numberOfLines={1}>
          {card.pickup.address}
        </ThemedText>
      </View>
      <View style={styles.routeRow}>
        <Ionicons name="location" size={12} color={theme.primary} />
        <ThemedText style={styles.routeText} numberOfLines={1}>
          {card.dropoff.address}
        </ThemedText>
      </View>

      {expanded ? (
        <View style={[styles.breakdown, { borderTopColor: theme.border }]}>
          {card.priceExplanation.map((line, i) => (
            <ThemedText key={i} style={[styles.breakdownLine, { color: theme.textSecondary }]}>
              {line}
            </ThemedText>
          ))}
          <View style={styles.paymentRow}>
            {(["cash", "wallet"] as const).map((m) => {
              const disabled = m === "wallet" && !walletCoversFare;
              const selected = paymentMethod === m;
              return (
                <Pressable
                  key={m}
                  disabled={disabled}
                  onPress={() => setPaymentMethod(m)}
                  style={[
                    styles.paymentChip,
                    {
                      backgroundColor: selected ? theme.primary : theme.backgroundDefault,
                      borderColor: selected ? theme.primary : theme.border,
                      opacity: disabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={m === "cash" ? "cash-outline" : "wallet-outline"}
                    size={14}
                    color={selected ? theme.textOnPrimary : theme.text}
                  />
                  <ThemedText style={[styles.paymentChipText, { color: selected ? theme.textOnPrimary : theme.text }]}>
                    {m === "cash" ? "Cash" : "Wallet"}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {declined ? (
        <ThemedText style={[styles.declinedText, { color: theme.textMuted }]}>
          No problem — just ask when you're ready.
        </ThemedText>
      ) : (
        <View style={styles.actionRow}>
          <Pressable onPress={() => setExpanded(!expanded)} style={styles.detailsToggle}>
            <ThemedText style={[styles.detailsToggleText, { color: theme.primary }]}>
              {expanded ? "Hide details" : "Details"}
            </ThemedText>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => {
              setDeclined(true);
              handlers.onEvent("book_ride", false, card.dropoff);
            }}
            style={[styles.secondaryButton, { borderColor: theme.border }]}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Not now</ThemedText>
          </Pressable>
          <Pressable
            onPress={confirmBooking}
            disabled={bookMutation.isPending}
            style={({ pressed }) => [
              styles.confirmButton,
              {
                backgroundColor: theme.primary,
                opacity: bookMutation.isPending ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            {bookMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.textOnPrimary} />
            ) : (
              <ThemedText style={styles.confirmButtonText}>Confirm ride</ThemedText>
            )}
          </Pressable>
        </View>
      )}
      {bookMutation.isError ? (
        <ThemedText style={[styles.errorText, { color: theme.error }]}>
          {(bookMutation.error as any)?.message || "Booking failed. Please try again."}
        </ThemedText>
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Live ride card — polls the real ride, deep-links to the full ActiveRide.
// ---------------------------------------------------------------------------
function LiveRideCard({ card }: { card: { type: "live_ride"; rideId: string; status?: string } }) {
  const { theme } = useTheme();
  const { liteMode } = useLiteMode();
  const navigation = useNavigation<any>();

  const { data: ride } = useQuery<any>({
    queryKey: ["/api/rides", card.rideId],
    refetchInterval: litePollMs(8000, liteMode),
  });

  const status = ride?.status || card.status || "pending";
  const statusLabel: Record<string, string> = {
    pending: "Finding your driver…",
    accepted: "Driver on the way",
    arriving: "Driver arriving",
    in_progress: "On the road",
    started: "On the road",
    completed: "Trip completed",
    cancelled: "Cancelled",
  };

  return (
    <Pressable onPress={() => navigation.navigate("ActiveRide", { rideId: card.rideId })}>
      <CardShell>
        <View style={styles.bookingHeader}>
          <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
            {status === "pending" ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="navigate-outline" size={18} color={theme.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.cardTitle}>{statusLabel[status] || status}</ThemedText>
            <ThemedText style={[styles.bookingMeta, { color: theme.textSecondary }]} numberOfLines={1}>
              {ride?.dropoffAddress ? `To ${ride.dropoffAddress}` : "Tap to track your ride"}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </View>
      </CardShell>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Places card — tap a place to get an instant deterministic quote.
// ---------------------------------------------------------------------------
function PlacesCard({
  card,
  handlers,
}: {
  card: Extract<AssistantCardData, { type: "places" }>;
  handlers: AssistantCardHandlers;
}) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.places.map((p, i) => (
        <Pressable
          key={`${p.address}-${i}`}
          onPress={() => handlers.onPickPlace(p)}
          style={({ pressed }) => [
            styles.placeRow,
            { borderBottomColor: theme.border, opacity: pressed ? 0.8 : 1 },
            i === card.places.length - 1 && !card.mapOption ? { borderBottomWidth: 0 } : null,
          ]}
        >
          <Ionicons name={(p.icon as any) || "location-outline"} size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.placeLabel}>{p.label}</ThemedText>
            <ThemedText style={[styles.placeReason, { color: theme.textMuted }]} numberOfLines={1}>
              {p.reason || p.address}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </Pressable>
      ))}
      {card.mapOption ? (
        <RowButton
          label="Pick on map"
          icon="map-outline"
          onPress={() => navigation.navigate("MapHome", {})}
        />
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Simple action card (open map / saved places).
// ---------------------------------------------------------------------------
function ActionCard({ card }: { card: Extract<AssistantCardData, { type: "action" }> }) {
  const navigation = useNavigation<any>();
  const go = () => {
    if (card.action === "open_saved_addresses") {
      navigation.getParent()?.navigate("ProfileTab", { screen: "SavedAddresses" });
    } else {
      navigation.navigate("MapHome", {});
    }
  };
  return (
    <CardShell>
      <RowButton
        label={card.label}
        icon={card.action === "open_saved_addresses" ? "bookmark-outline" : "map-outline"}
        onPress={go}
        tone="primary"
      />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Wallet card — balance + recent activity, deep-links to the Wallet tab.
// ---------------------------------------------------------------------------
function WalletCard({ card }: { card: Extract<AssistantCardData, { type: "wallet" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? card.transactions : card.transactions.slice(0, 2);
  return (
    <CardShell>
      <Pressable onPress={() => navigation.getParent()?.navigate("WalletTab")} style={styles.bookingHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
          <Ionicons name="wallet-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.bookingFare}>
            {card.currency} {parseFloat(card.balance).toFixed(2)}
          </ThemedText>
          <ThemedText style={[styles.bookingMeta, { color: theme.textSecondary }]}>Wallet balance</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
      {shown.map((t) => (
        <View key={t.id} style={[styles.txRow, { borderTopColor: theme.border }]}>
          <ThemedText style={[styles.txDesc, { color: theme.textSecondary }]} numberOfLines={1}>
            {t.description || t.type}
          </ThemedText>
          <ThemedText style={styles.txAmount}>
            {t.currency} {parseFloat(t.amount).toFixed(2)}
          </ThemedText>
        </View>
      ))}
      {card.transactions.length > 2 && !expanded ? (
        <Pressable onPress={() => setExpanded(true)} style={styles.detailsToggle}>
          <ThemedText style={[styles.detailsToggleText, { color: theme.primary }]}>
            Show more
          </ThemedText>
        </Pressable>
      ) : null}
      {card.transactions.length === 0 ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>No transactions yet.</ThemedText>
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Rides history card — compact recent trips, tap to open the receipt.
// ---------------------------------------------------------------------------
function RidesCard({ card }: { card: Extract<AssistantCardData, { type: "rides" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? card.rides : card.rides.slice(0, 2);
  return (
    <CardShell>
      {card.rides.length === 0 ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>
          No completed trips yet — your first one is a message away.
        </ThemedText>
      ) : (
        shown.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => navigation.navigate("Invoice", { rideId: r.id })}
            style={({ pressed }) => [
              styles.placeRow,
              { borderBottomColor: theme.border, opacity: pressed ? 0.8 : 1 },
              i === shown.length - 1 ? { borderBottomWidth: 0 } : null,
            ]}
          >
            <Ionicons name="time-outline" size={18} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.placeLabel} numberOfLines={1}>
                {r.dropoffAddress}
              </ThemedText>
              <ThemedText style={[styles.placeReason, { color: theme.textMuted }]}>
                {new Date(r.createdAt).toLocaleDateString()} · {r.currency}{" "}
                {parseFloat(r.fare).toFixed(2)}
                {r.hasBlockchainProof ? " · verified" : ""}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        ))
      )}
      {card.rides.length > 2 && !expanded ? (
        <Pressable onPress={() => setExpanded(true)} style={styles.detailsToggle}>
          <ThemedText style={[styles.detailsToggleText, { color: theme.primary }]}>
            Show all {card.rides.length}
          </ThemedText>
        </Pressable>
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Coffee card — quick menu preview, deep-links into the Coffee screen.
// ---------------------------------------------------------------------------
function CoffeeCard({ card }: { card: Extract<AssistantCardData, { type: "coffee" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.items.slice(0, 4).map((item, i) => (
        <Pressable
          key={item.id}
          onPress={() => navigation.navigate("Coffee")}
          style={({ pressed }) => [
            styles.placeRow,
            { borderBottomColor: theme.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="cafe-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.placeLabel}>{item.name}</ThemedText>
            <ThemedText style={[styles.placeReason, { color: theme.textMuted }]} numberOfLines={1}>
              {item.description}
            </ThemedText>
          </View>
          <ThemedText style={[styles.txAmount, { color: theme.textSecondary }]}>
            {item.currency} {item.basePrice}
          </ThemedText>
        </Pressable>
      ))}
      <RowButton label="Open coffee menu" icon="cafe-outline" onPress={() => navigation.navigate("Coffee")} tone="primary" />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Prayer rides card.
// ---------------------------------------------------------------------------
function PrayerCard({ card }: { card: Extract<AssistantCardData, { type: "prayer" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.subscriptions.map((s) => (
        <View key={s.id} style={styles.placeRow}>
          <Ionicons name="moon-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.placeLabel}>{s.mosqueName}</ThemedText>
            <ThemedText style={[styles.placeReason, { color: theme.textMuted }]}>
              {s.prayers.split(",").join(" · ")} · {s.status}
            </ThemedText>
          </View>
        </View>
      ))}
      <RowButton
        label={card.subscriptions.length > 0 ? "Manage prayer rides" : "Set up prayer rides"}
        icon="moon-outline"
        onPress={() => navigation.navigate("PrayerRides")}
        tone="primary"
      />
      <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>
        Prayer rides are always free — drivers volunteer.
      </ThemedText>
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Scheduled arrivals card.
// ---------------------------------------------------------------------------
function ArrivalCard({ card }: { card: Extract<AssistantCardData, { type: "arrival" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.arrivals.map((a) => (
        <View key={a.id} style={styles.placeRow}>
          <Ionicons name="alarm-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.placeLabel}>{a.label}</ThemedText>
            <ThemedText style={[styles.placeReason, { color: theme.textMuted }]} numberOfLines={1}>
              {a.destAddress}
              {a.arriveTimeLocal ? ` · by ${a.arriveTimeLocal}` : ""}
            </ThemedText>
          </View>
        </View>
      ))}
      <RowButton
        label={card.arrivals.length > 0 ? "Manage arrivals" : "Schedule an arrival"}
        icon="alarm-outline"
        onPress={() => navigation.navigate("ScheduledArrivals")}
        tone="primary"
      />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Rewards card — coins + diamonds balances, streak, deep-link to Rewards.
// ---------------------------------------------------------------------------
function RewardsCard({ card }: { card: Extract<AssistantCardData, { type: "rewards" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      <View style={styles.bookingHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
          <Ionicons name="star-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.bookingFare}>{card.coins} coins · {card.diamonds} diamonds</ThemedText>
          <ThemedText style={[styles.bookingMeta, { color: theme.textSecondary }]}>
            {card.checkedInToday ? `Checked in today · Day ${card.streakDay}` : `Check in to earn ${card.nextCheckInCoins} coins`}
          </ThemedText>
        </View>
      </View>
      {card.diamonds >= 200 ? (
        <View style={[styles.breakdown, { borderTopColor: theme.border }]}>
          <ThemedText style={[styles.breakdownLine, { color: theme.textSecondary }]}>
            {card.diamonds} diamonds = AED {card.cashableAed} cashable to wallet
          </ThemedText>
        </View>
      ) : null}
      <RowButton label="Open Rewards" icon="star-outline" onPress={() => navigation.navigate("Rewards")} tone="primary" />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Missions card — daily missions with completion status.
// ---------------------------------------------------------------------------
function MissionsCard({ card }: { card: Extract<AssistantCardData, { type: "missions" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.missions.map((m, i) => (
        <View
          key={m.key}
          style={[
            styles.placeRow,
            { borderBottomColor: theme.border },
            i === card.missions.length - 1 ? { borderBottomWidth: 0 } : null,
          ]}
        >
          <Ionicons
            name={m.completed ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={m.completed ? theme.primary : theme.textMuted}
          />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.placeLabel, { color: m.completed ? theme.textMuted : theme.text }]}>
              {m.name}
            </ThemedText>
          </View>
          <ThemedText style={[styles.txAmount, { color: m.completed ? theme.textMuted : theme.primary }]}>
            +{m.coins}
          </ThemedText>
        </View>
      ))}
      <RowButton label="Rewards hub" icon="star-outline" onPress={() => navigation.navigate("Rewards")} tone="primary" />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Earnings card — driver earnings summary with recent rides list.
// ---------------------------------------------------------------------------
function EarningsCard({ card }: { card: Extract<AssistantCardData, { type: "earnings" }> }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? card.rides : card.rides.slice(0, 2);
  return (
    <CardShell>
      <View style={styles.bookingHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
          <Ionicons name="trending-up-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.bookingFare}>AED {card.totalAed}</ThemedText>
          <ThemedText style={[styles.bookingMeta, { color: theme.textSecondary }]}>
            {card.rideCount} rides · last {card.days} days
          </ThemedText>
        </View>
      </View>
      {shown.map((r, i) => (
        <View key={`${r.date}-${i}`} style={[styles.txRow, { borderTopColor: theme.border }]}>
          <ThemedText style={[styles.txDesc, { color: theme.textSecondary }]} numberOfLines={1}>
            {r.to || "Trip"}
          </ThemedText>
          <ThemedText style={styles.txAmount}>AED {parseFloat(r.earnings || "0").toFixed(2)}</ThemedText>
        </View>
      ))}
      {card.rides.length > 2 && !expanded ? (
        <Pressable onPress={() => setExpanded(true)} style={styles.detailsToggle}>
          <ThemedText style={[styles.detailsToggleText, { color: theme.primary }]}>Show all</ThemedText>
        </Pressable>
      ) : null}
      {card.rides.length === 0 ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>No rides yet in this period.</ThemedText>
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Car Ladder card — progress toward next vehicle.
// ---------------------------------------------------------------------------
function LadderCard({ card }: { card: Extract<AssistantCardData, { type: "ladder" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const pct = Math.min(Math.max(card.progressPercent, 0), 100);
  return (
    <CardShell>
      <View style={styles.bookingHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
          <Ionicons name="car-sport-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.cardTitle}>{card.targetName}</ThemedText>
          <ThemedText style={[styles.bookingMeta, { color: theme.textSecondary }]}>
            {card.currency} {card.totalContributed.toFixed(2)} contributed · {pct.toFixed(0)}%
          </ThemedText>
        </View>
        {card.qualified ? (
          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
        ) : null}
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${pct}%` as any }]} />
      </View>
      {card.agentMessage ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textSecondary }]}>{card.agentMessage}</ThemedText>
      ) : null}
      <RowButton label="Vehicle Wallet" icon="car-sport-outline" onPress={() => navigation.navigate("VehicleWallet")} tone="primary" />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Pending rides card — driver view of open ride requests.
// ---------------------------------------------------------------------------
function PendingRidesCard({ card }: { card: Extract<AssistantCardData, { type: "pending_rides" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.rides.length === 0 ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>No open ride requests right now.</ThemedText>
      ) : (
        card.rides.map((r, i) => (
          <View
            key={r.id}
            style={[styles.placeRow, { borderBottomColor: theme.border }, i === card.rides.length - 1 ? { borderBottomWidth: 0 } : null]}
          >
            <Ionicons name="radio-button-on" size={14} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.placeLabel} numberOfLines={1}>{r.dropoff}</ThemedText>
              <ThemedText style={[styles.placeReason, { color: theme.textMuted }]} numberOfLines={1}>
                From: {r.pickup}
              </ThemedText>
            </View>
            <ThemedText style={[styles.txAmount, { color: theme.primary }]}>AED {parseFloat(r.fare || "0").toFixed(2)}</ThemedText>
          </View>
        ))
      )}
      <RowButton label="Go online to accept" icon="navigate-outline" onPress={() => navigation.getParent()?.navigate("DriverHome")} tone="primary" />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Coffee orders card — driver-facing pending orders.
// ---------------------------------------------------------------------------
function CoffeeOrdersCard({ card }: { card: Extract<AssistantCardData, { type: "coffee_orders" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <CardShell>
      {card.orders.length === 0 ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>No pending coffee orders.</ThemedText>
      ) : (
        card.orders.map((o, i) => (
          <View
            key={o.id}
            style={[styles.placeRow, { borderBottomColor: theme.border }, i === card.orders.length - 1 ? { borderBottomWidth: 0 } : null]}
          >
            <Ionicons name="cafe-outline" size={18} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.placeLabel}>{o.item}{o.size ? ` · ${o.size}` : ""}</ThemedText>
              {o.deliveryAddress ? (
                <ThemedText style={[styles.placeReason, { color: theme.textMuted }]} numberOfLines={1}>{o.deliveryAddress}</ThemedText>
              ) : null}
            </View>
            {o.totalAmount ? (
              <ThemedText style={styles.txAmount}>AED {parseFloat(o.totalAmount).toFixed(2)}</ThemedText>
            ) : null}
          </View>
        ))
      )}
      <RowButton label="Open Coffee Orders" icon="cafe-outline" onPress={() => navigation.navigate("CoffeeOrders")} tone="primary" />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Trending card — hot routes + search terms.
// ---------------------------------------------------------------------------
function TrendingCard({ card }: { card: Extract<AssistantCardData, { type: "trending" }> }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const hasRoutes = card.routes.length > 0;
  const hasTerms = card.terms.length > 0;
  return (
    <CardShell>
      {hasRoutes ? (
        <>
          <ThemedText style={[styles.breakdownLine, { color: theme.textMuted }]}>Hot routes</ThemedText>
          {card.routes.map((r, i) => (
            <View key={`r-${i}`} style={[styles.placeRow, { borderBottomColor: theme.border }]}>
              <Ionicons name={r.rising ? "trending-up" : "remove-outline"} size={16} color={r.rising ? theme.primary : theme.textMuted} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.placeLabel} numberOfLines={1}>{r.label}</ThemedText>
                {r.city ? <ThemedText style={[styles.placeReason, { color: theme.textMuted }]}>{r.city}</ThemedText> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}
      {hasTerms ? (
        <>
          <ThemedText style={[styles.breakdownLine, { color: theme.textMuted, marginTop: hasRoutes ? Spacing.sm : 0 }]}>Trending searches</ThemedText>
          <View style={styles.paymentRow}>
            {card.terms.map((t, i) => (
              <Pressable
                key={`t-${i}`}
                onPress={() => navigation.navigate("Discover", { initialQuery: t.label })}
                style={[styles.paymentChip, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
              >
                <ThemedText style={[styles.paymentChipText, { color: theme.text }]}>{t.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {!hasRoutes && !hasTerms ? (
        <ThemedText style={[styles.emptyLine, { color: theme.textMuted }]}>No trending data yet — check back after more rides.</ThemedText>
      ) : null}
      <RowButton label="Explore trending" icon="search-outline" onPress={() => navigation.navigate("Discover")} />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher.
// ---------------------------------------------------------------------------
export function AssistantCard({
  card,
  handlers,
}: {
  card: AssistantCardData;
  handlers: AssistantCardHandlers;
}) {
  switch (card.type) {
    case "booking":
      return <BookingCard card={card} handlers={handlers} />;
    case "live_ride":
      return <LiveRideCard card={card} />;
    case "places":
      return <PlacesCard card={card} handlers={handlers} />;
    case "action":
      return <ActionCard card={card} />;
    case "wallet":
      return <WalletCard card={card} />;
    case "rides":
      return <RidesCard card={card} />;
    case "coffee":
      return FEATURES.coffee ? <CoffeeCard card={card} /> : null;
    case "prayer":
      return FEATURES.prayerRides ? <PrayerCard card={card} /> : null;
    case "arrival":
      return FEATURES.onTimeArrivals ? <ArrivalCard card={card} /> : null;
    case "rewards":
      return <RewardsCard card={card} />;
    case "missions":
      return <MissionsCard card={card} />;
    case "earnings":
      return <EarningsCard card={card} />;
    case "ladder":
      // Car Ladder is long tail — hidden unless the flag is on.
      return FEATURES.carLadder ? <LadderCard card={card} /> : null;
    case "pending_rides":
      return <PendingRidesCard card={card} />;
    case "coffee_orders":
      return FEATURES.coffee ? <CoffeeOrdersCard card={card} /> : null;
    case "trending":
      return <TrendingCard card={card} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  bookingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingFare: {
    ...Typography.xlHeavy,
    letterSpacing: -0.5,
  },
  bookingMeta: {
    ...Typography.small,
    marginTop: 2,
  },
  cardTitle: {
    ...Typography.bodyBold,
    letterSpacing: -0.2,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  routeText: {
    ...Typography.small,
    flex: 1,
  },
  breakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    gap: 4,
  },
  breakdownLine: {
    ...Typography.caption,
  },
  paymentRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  paymentChipText: {
    ...Typography.smallBold,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: Spacing.sm,
    marginRight: "auto",
  },
  detailsToggleText: {
    ...Typography.smallBold,
  },
  secondaryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...Typography.smallBold,
  },
  confirmButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    minWidth: 132,
    alignItems: "center",
    ...Shadows.card,
  },
  confirmButtonText: {
    ...Typography.labelHeavy,
    color: Colors.light.textOnPrimary,
    letterSpacing: 0.1,
  },
  declinedText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeLabel: {
    ...Typography.bodyMedium,
  },
  placeReason: {
    ...Typography.caption,
    marginTop: 1,
  },
  rowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xs,
  },
  rowButtonText: {
    ...Typography.labelBold,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  txDesc: {
    ...Typography.small,
    flex: 1,
  },
  txAmount: {
    ...Typography.smallBold,
  },
  emptyLine: {
    ...Typography.caption,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
});
