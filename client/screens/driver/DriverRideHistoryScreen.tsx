import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface Driver {
  id: string;
  userId: string;
}

interface Ride {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: string;
  actualFare?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  customer?: {
    name: string;
  };
}

export default function DriverRideHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  // First get the driver record
  const { data: driverData } = useQuery<Driver>({
    queryKey: ["/api/drivers/by-user", user?.id],
    enabled: !!user?.id && user?.role === "driver",
  });

  const driverId = driverData?.id;

  // Then fetch rides for this driver
  const { data: rides, isLoading } = useQuery<Ride[]>({
    queryKey: [`/api/rides?driverId=${driverId}`],
    enabled: !!driverId,
  });

  // Filter to show only completed and cancelled rides
  const historyRides = (rides || []).filter(
    (ride) => ride.status === "completed" || ride.status === "cancelled"
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return Colors.travonyGreen;
      case "cancelled":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  const renderRideItem = ({ item }: { item: Ride }) => (
    <Pressable style={[styles.rideItem, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.rideHeader}>
        <View style={styles.customerInfo}>
          <View style={[styles.customerAvatar, { backgroundColor: Colors.travonyGreen + "20" }]}>
            <ThemedText style={[styles.avatarText, { color: Colors.travonyGreen }]}>
              {(item.customer?.name || "C").charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View>
            <ThemedText style={styles.customerName}>
              {item.customer?.name || "Customer"}
            </ThemedText>
            <ThemedText style={[styles.rideDate, { color: theme.textSecondary }]}>
              {formatDate(item.completedAt || item.createdAt)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.fareInfo}>
          <ThemedText style={[styles.fareAmount, { color: getStatusColor(item.status) }]}>
            AED {item.actualFare || item.estimatedFare || "0.00"}
          </ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
            <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.locationInfo}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: Colors.travonyGreen }]} />
          <ThemedText style={styles.locationText} numberOfLines={1}>
            {item.pickupAddress}
          </ThemedText>
        </View>
        <View style={[styles.locationLine, { backgroundColor: theme.border }]} />
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
          <ThemedText style={styles.locationText} numberOfLines={1}>
            {item.dropoffAddress}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={48} color={theme.textMuted} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No route history yet
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textMuted }]}>
        Completed routes will appear here
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
        <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Loading ride history...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={historyRides}
        keyExtractor={(item) => item.id}
        renderItem={renderRideItem}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  rideItem: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  rideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...Typography.body,
    fontWeight: "700",
  },
  customerName: {
    ...Typography.body,
    fontWeight: "600",
  },
  rideDate: {
    ...Typography.small,
    marginTop: 2,
  },
  fareInfo: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  fareAmount: {
    ...Typography.h4,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  locationInfo: {
    paddingLeft: Spacing.xs,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 2,
  },
  locationText: {
    ...Typography.body,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h4,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
});
