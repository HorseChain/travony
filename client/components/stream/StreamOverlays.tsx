import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeInDown,
  FadeOutUp,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import type { StreamEvent } from "@/hooks/useStreamChannel";

// ---------------------------------------------------------------------------
// Viewer count chip — updated only from server-published viewer.count events
// (already throttled server-side), so it can never flap per join/leave.
// ---------------------------------------------------------------------------

export function ViewerCountChip({ count }: { count: number }) {
  return (
    <View style={styles.viewerChip}>
      <Ionicons name="eye-outline" size={13} color="#fff" />
      <ThemedText style={styles.viewerChipText}>{count}</ThemedText>
    </View>
  );
}

export function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gift animation layer. Small gifts queue and play serialized (max ~4s each,
// queue capped) so a gift storm degrades gracefully instead of freezing the
// UI; identical gifts arriving close together collapse into a combo counter.
// Premium gifts (server-tagged tier) get a full-screen moment.
// ---------------------------------------------------------------------------

interface GiftDisplay {
  key: string; // giftKey for combo batching
  giftName: string;
  senderName: string;
  tier: "small" | "premium";
  combo: number;
}

const GIFT_QUEUE_CAP = 30;
const COMBO_WINDOW_MS = 2000;
const SMALL_GIFT_MS = 2600;
const PREMIUM_GIFT_MS = 4000;

const GIFT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  rose: "rose-outline",
  karak: "cafe-outline",
  falcon: "paper-plane-outline",
  dune: "sunny-outline",
  pearl: "ellipse-outline",
  oud: "flame-outline",
  yacht: "boat-outline",
  travony_star: "star-outline",
};

export function useGiftAnimations() {
  const queueRef = useRef<GiftDisplay[]>([]);
  const playingRef = useRef(false);
  const [current, setCurrent] = useState<GiftDisplay | null>(null);
  const lastEnqueuedRef = useRef<{ key: string; sender: string; at: number } | null>(null);

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      setCurrent(null);
      return;
    }
    playingRef.current = true;
    setCurrent(next);
    setTimeout(playNext, next.tier === "premium" ? PREMIUM_GIFT_MS : SMALL_GIFT_MS);
  }, []);

  const onGiftEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type !== "gift.sent") return;
      const d = event.data || {};
      const display: GiftDisplay = {
        key: String(d.giftKey || "gift"),
        giftName: String(d.giftName || "Gift"),
        senderName: String(d.senderName || "Someone"),
        tier: d.tier === "premium" ? "premium" : "small",
        combo: 1,
      };

      // Combo batching: same gift from the same sender within the window
      // bumps the counter of the queued (or last) entry instead of queueing.
      const last = lastEnqueuedRef.current;
      const now = Date.now();
      if (
        last &&
        last.key === display.key &&
        last.sender === display.senderName &&
        now - last.at < COMBO_WINDOW_MS
      ) {
        const tail = queueRef.current[queueRef.current.length - 1];
        if (tail && tail.key === display.key && tail.senderName === display.senderName) {
          tail.combo += 1;
          lastEnqueuedRef.current = { ...last, at: now };
          return;
        }
      }
      lastEnqueuedRef.current = { key: display.key, sender: display.senderName, at: now };

      if (queueRef.current.length >= GIFT_QUEUE_CAP) queueRef.current.shift(); // drop oldest
      queueRef.current.push(display);
      if (!playingRef.current) playNext();
    },
    [playNext],
  );

  return { current, onGiftEvent };
}

export function GiftAnimationLayer({ gift }: { gift: GiftDisplay | null }) {
  if (!gift) return null;
  return gift.tier === "premium" ? <PremiumGiftMoment gift={gift} /> : <SmallGiftToast gift={gift} />;
}

function SmallGiftToast({ gift }: { gift: GiftDisplay }) {
  const icon = GIFT_ICONS[gift.key] || "gift-outline";
  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(250)}
      style={styles.giftToast}
      pointerEvents="none"
      key={`${gift.key}-${gift.senderName}-${gift.combo}`}
    >
      <View style={styles.giftIconCircle}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.giftToastName} numberOfLines={1}>
          {gift.senderName}
        </ThemedText>
        <ThemedText style={styles.giftToastLabel} numberOfLines={1}>
          sent a {gift.giftName}
        </ThemedText>
      </View>
      {gift.combo > 1 ? (
        <ThemedText style={styles.comboText}>x{gift.combo}</ThemedText>
      ) : null}
    </Animated.View>
  );
}

function PremiumGiftMoment({ gift }: { gift: GiftDisplay }) {
  const icon = GIFT_ICONS[gift.key] || "diamond-outline";
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.15, { duration: 450, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 250 }),
      withDelay(PREMIUM_GIFT_MS - 1200, withTiming(1.4, { duration: 450 })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 350 }),
      withDelay(PREMIUM_GIFT_MS - 1150, withTiming(0, { duration: 400 })),
    );
  }, [gift]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.premiumOverlay} pointerEvents="none">
      <Animated.View style={[styles.premiumCard, style]}>
        <View style={styles.premiumIconCircle}>
          <Ionicons name={icon} size={44} color="#FFD66B" />
        </View>
        <ThemedText style={styles.premiumSender}>{gift.senderName}</ThemedText>
        <ThemedText style={styles.premiumLabel}>
          sent a {gift.giftName}
          {gift.combo > 1 ? ` x${gift.combo}` : ""}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shop the Look card — snapshot comes entirely from server events / snapshot
// endpoint. Tap logs fire-and-forget and never block the video.
// ---------------------------------------------------------------------------

export interface ActiveProduct {
  productId: string;
  productKey: string;
  title: string;
  imageUrl: string | null;
  priceLabel: string;
  ttlSeconds: number;
}

export function ShopTheLookCard({
  product,
  onExpired,
}: {
  product: ActiveProduct;
  onExpired: () => void;
}) {
  const { theme } = useTheme();

  useEffect(() => {
    const t = setTimeout(onExpired, Math.max(5, product.ttlSeconds) * 1000);
    return () => clearTimeout(t);
  }, [product.productId]);

  const handleTap = () => {
    apiRequest(`/api/agora/products/${product.productId}/tap`, { method: "POST" }).catch(() => {});
  };

  return (
    <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutUp.duration(250)}>
      <Pressable style={[styles.productCard, { backgroundColor: theme.backgroundElevated }]} onPress={handleTap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImageFallback]}>
            <Ionicons name="bag-handle-outline" size={22} color={Colors.light.textOnPrimary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.productBadge}>SHOP THE LOOK</ThemedText>
          <ThemedText style={styles.productTitle} numberOfLines={1}>
            {product.title}
          </ThemedText>
          <ThemedText style={[styles.productPrice, { color: theme.primary }]}>
            {product.priceLabel}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  viewerChipText: {
    ...Typography.smallBold,
    color: "#fff",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.liveRed,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveBadgeText: {
    ...Typography.smallBold,
    color: "#fff",
    letterSpacing: 1,
  },
  giftToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    maxWidth: 280,
  },
  giftIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  giftToastName: {
    ...Typography.smallBold,
    color: "#fff",
  },
  giftToastLabel: {
    ...Typography.small,
    color: "rgba(255,255,255,0.85)",
  },
  comboText: {
    ...Typography.h4,
    color: "#FFD66B",
  },
  premiumOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumCard: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl * 1.5,
  },
  premiumIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,214,107,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  premiumSender: {
    ...Typography.h3,
    color: "#fff",
  },
  premiumLabel: {
    ...Typography.body,
    color: "rgba(255,255,255,0.85)",
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  productImage: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
  },
  productImageFallback: {
    backgroundColor: "#7A5AF8",
    alignItems: "center",
    justifyContent: "center",
  },
  productBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    opacity: 0.6,
  },
  productTitle: {
    ...Typography.bodyBold,
  },
  productPrice: {
    ...Typography.smallBold,
  },
});
