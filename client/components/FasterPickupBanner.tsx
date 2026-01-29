import { View, StyleSheet, Pressable, Platform } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface PmgthDriver {
  driverId: string;
  sessionId: string;
  directionScore: number;
  premiumAmount: number;
  premiumPercent: number;
  estimatedPickupMinutes: number;
}

interface Props {
  rideId?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  baseFare: number;
  onSelectFasterPickup?: (driver: PmgthDriver | null) => void;
  selectedDriver?: PmgthDriver | null;
}

export function FasterPickupBanner({
  rideId,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  baseFare,
  onSelectFasterPickup,
  selectedDriver,
}: Props) {
  const { theme } = useTheme();

  const { data, isLoading } = useQuery<{
    available: boolean;
    drivers: PmgthDriver[];
    bestOption?: PmgthDriver;
  }>({
    queryKey: ["/api/pmgth/check-availability", pickupLat, pickupLng, dropoffLat, dropoffLng, baseFare],
    queryFn: async () => {
      try {
        const url = new URL("/api/pmgth/check-availability", getApiUrl());
        url.searchParams.set("pickupLat", pickupLat.toString());
        url.searchParams.set("pickupLng", pickupLng.toString());
        url.searchParams.set("dropoffLat", dropoffLat.toString());
        url.searchParams.set("dropoffLng", dropoffLng.toString());
        url.searchParams.set("baseFare", baseFare.toString());
        return await apiRequest(url.toString(), { method: "GET" });
      } catch {
        return { available: false, drivers: [] };
      }
    },
    enabled: !rideId,
    staleTime: 30000,
  });

  if (isLoading || !data?.available || !data.bestOption) {
    return null;
  }

  const driver = data.bestOption;
  const isSelected = selectedDriver?.driverId === driver.driverId;
  const totalFare = baseFare + driver.premiumAmount;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectFasterPickup?.(isSelected ? null : driver);
  };

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? Colors.travonyGreen : theme.backgroundElevated,
          borderColor: isSelected ? Colors.travonyGreen : theme.border,
        },
      ]}
      onPress={handlePress}
    >
      <View style={[styles.flashCircle, { backgroundColor: isSelected ? "#fff" : Colors.travonyGreen }]}>
        <Ionicons name="flash" size={18} color={isSelected ? Colors.travonyGreen : "#fff"} />
      </View>

      <View style={styles.center}>
        <ThemedText style={[styles.time, isSelected && styles.timeSelected]}>
          {driver.estimatedPickupMinutes} min
        </ThemedText>
      </View>

      <View style={styles.right}>
        <ThemedText style={[styles.price, isSelected && styles.priceSelected]}>
          ${totalFare.toFixed(0)}
        </ThemedText>
        {isSelected ? (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color={Colors.travonyGreen} />
          </View>
        ) : (
          <View style={[styles.emptyCircle, { borderColor: theme.border }]} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  flashCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  time: {
    ...Typography.h4,
    fontWeight: "700",
  },
  timeSelected: {
    color: "#fff",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  price: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  priceSelected: {
    color: "#fff",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
});
