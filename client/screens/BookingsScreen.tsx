import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { BookingsStackParamList } from "@/navigation/BookingsStackNavigator";

type NavigationProp = NativeStackNavigationProp<BookingsStackParamList, "Bookings">;

interface Booking {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  actualFare: string | null;
  estimatedFare: string | null;
  createdAt: string;
  driverName?: string;
}

const statusColors: Record<string, string> = {
  completed: "#43A047",
  cancelled: "#E53935",
  pending: "#FB8C00",
  accepted: "#00B14F",
  in_progress: "#00B14F",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Matching",
  accepted: "Vehicle Assigned",
  arriving: "Vehicle Approaching",
  started: "In Transit",
  in_progress: "In Transit",
};

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const { data: bookings = [], isLoading, refetch } = useQuery<Booking[]>({
    queryKey: [`/api/rides?customerId=${user?.id}`],
    enabled: !!user?.id,
  });

  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === "upcoming") {
      return ["pending", "accepted", "arriving", "started", "in_progress"].includes(booking.status);
    }
    return ["completed", "cancelled"].includes(booking.status);
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderBookingItem = ({ item }: { item: Booking }) => (
    <Card
      style={styles.bookingCard}
      onPress={() => navigation.navigate("RideDetails", { rideId: item.id })}
    >
      <View style={styles.bookingHeader}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: (statusColors[item.status] || theme.primary) + "20" },
          ]}
        >
          <ThemedText
            style={[
              styles.statusText,
              { color: statusColors[item.status] || theme.primary },
            ]}
          >
            {statusLabels[item.status] || item.status}
          </ThemedText>
        </View>
        <ThemedText style={[styles.bookingDate, { color: theme.textMuted }]}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.primary }]} />
          <ThemedText style={styles.locationText} numberOfLines={1}>
            {item.pickupAddress}
          </ThemedText>
        </View>
        <View style={styles.locationLine}>
          <View style={[styles.verticalDash, { borderColor: theme.border }]} />
        </View>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
          <ThemedText style={styles.locationText} numberOfLines={1}>
            {item.dropoffAddress}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.bookingFooter, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.fareText}>
          AED {item.actualFare || item.estimatedFare || "0.00"}
        </ThemedText>
        <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Ionicons name="map-outline" size={48} color={theme.textMuted} />
      </View>
      <ThemedText style={styles.emptyTitle}>No Bookings Yet</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {activeTab === "upcoming"
          ? "Your upcoming rides will appear here"
          : "Your past rides will appear here"}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabContainer, { paddingTop: headerHeight + Spacing.md }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "upcoming" && [styles.activeTab, { borderBottomColor: theme.primary }],
          ]}
          onPress={() => setActiveTab("upcoming")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "upcoming"
                ? { color: theme.primary }
                : { color: theme.textMuted },
            ]}
          >
            Upcoming
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === "past" && [styles.activeTab, { borderBottomColor: theme.primary }],
          ]}
          onPress={() => setActiveTab("past")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "past"
                ? { color: theme.primary }
                : { color: theme.textMuted },
            ]}
          >
            Past
          </ThemedText>
        </Pressable>
      </View>

      <FlatList
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    ...Typography.button,
  },
  bookingCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  bookingDate: {
    ...Typography.small,
  },
  locationContainer: {
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  locationText: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  locationLine: {
    paddingLeft: 4,
    paddingVertical: Spacing.xs,
  },
  verticalDash: {
    width: 1,
    height: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    marginLeft: 0,
  },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  fareText: {
    ...Typography.h4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
});
