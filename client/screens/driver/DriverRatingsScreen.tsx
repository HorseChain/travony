import { View, StyleSheet, ScrollView, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface Rating {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customer?: {
    name: string;
  };
}

interface Driver {
  id: string;
  userId: string;
  rating: string;
  totalTrips: number;
}

interface RatingsData {
  ratings: Rating[];
  averageRating: string;
  totalRatings: number;
  ratingBreakdown: { [key: number]: number };
}

export default function DriverRatingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const { data: driverData } = useQuery<Driver>({
    queryKey: ["/api/drivers/by-user", user?.id],
    enabled: !!user?.id && user?.role === "driver",
  });

  const driverId = driverData?.id;

  const { data: ratingsData, isLoading } = useQuery<RatingsData>({
    queryKey: ["/api/drivers", driverId, "ratings"],
    enabled: !!driverId,
  });

  const averageRating = parseFloat(ratingsData?.averageRating || driverData?.rating || "5.0");
  const totalRatings = ratingsData?.totalRatings || 0;
  const ratings = ratingsData?.ratings || [];
  const breakdown = ratingsData?.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const starColor = theme.warning;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={starColor}
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (star: number, count: number) => {
    const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
    return (
      <View key={star} style={styles.ratingBarRow}>
        <ThemedText style={[styles.starLabel, { color: theme.textSecondary }]}>{star}</ThemedText>
        <Ionicons name="star" size={12} color={starColor} />
        <View style={[styles.barContainer, { backgroundColor: theme.border }]}>
          <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: starColor }]} />
        </View>
        <ThemedText style={[styles.countLabel, { color: theme.textMuted }]}>{count}</ThemedText>
      </View>
    );
  };

  const renderRatingItem = ({ item }: { item: Rating }) => (
    <View style={[styles.ratingCard, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.ratingHeader}>
        <View style={styles.customerInfo}>
          <View style={[styles.avatar, { backgroundColor: Colors.travonyGreen + "20" }]}>
            <ThemedText style={[styles.avatarText, { color: Colors.travonyGreen }]}>
              {(item.customer?.name || "C").charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View>
            <ThemedText style={styles.customerName}>{item.customer?.name || "Customer"}</ThemedText>
            <ThemedText style={[styles.ratingDate, { color: theme.textMuted }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
        </View>
        {renderStars(item.rating)}
      </View>
      {item.comment ? (
        <ThemedText style={[styles.comment, { color: theme.textSecondary }]}>
          "{item.comment}"
        </ThemedText>
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={ratings}
        keyExtractor={(item) => item.id}
        renderItem={renderRatingItem}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        ListHeaderComponent={
          <>
            <View style={[styles.overviewCard, { backgroundColor: theme.backgroundElevated }]}>
              <View style={styles.ratingOverview}>
                <ThemedText style={styles.bigRating}>{averageRating.toFixed(1)}</ThemedText>
                {renderStars(Math.round(averageRating), 24)}
                <ThemedText style={[styles.totalReviews, { color: theme.textSecondary }]}>
                  Based on {totalRatings} {totalRatings === 1 ? "review" : "reviews"}
                </ThemedText>
              </View>

              <View style={styles.breakdownContainer}>
                {[5, 4, 3, 2, 1].map((star) => renderRatingBar(star, breakdown[star] || 0))}
              </View>
            </View>

            {ratings.length > 0 ? (
              <ThemedText style={styles.sectionTitle}>Recent Reviews</ThemedText>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundElevated }]}>
            <Ionicons name="chatbubble-outline" size={48} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
              No reviews yet
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Complete rides to receive ratings from customers
            </ThemedText>
          </View>
        }
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
  overviewCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  ratingOverview: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  bigRating: {
    fontSize: 56,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
  },
  totalReviews: {
    ...Typography.body,
    marginTop: Spacing.sm,
  },
  breakdownContainer: {
    gap: Spacing.sm,
  },
  ratingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  starLabel: {
    ...Typography.small,
    width: 12,
    textAlign: "right",
  },
  barContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  countLabel: {
    ...Typography.small,
    width: 30,
    textAlign: "right",
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  ratingCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  ratingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
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
  ratingDate: {
    ...Typography.small,
    marginTop: 2,
  },
  comment: {
    ...Typography.body,
    marginTop: Spacing.md,
    fontStyle: "italic",
  },
  emptyState: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: "center",
  },
});
