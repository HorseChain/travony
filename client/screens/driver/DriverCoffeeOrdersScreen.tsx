import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type TabMode = "available" | "my_orders";

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.light.warning,
  accepted: Colors.light.info,
  preparing: Colors.light.blockchain,
  ready: Colors.light.evGreen,
  picked_up: Colors.light.info,
  delivering: Colors.light.warning,
  delivered: Colors.travonyGreen,
  cancelled: Colors.light.error,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for driver",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  delivering: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const NEXT_STATUS: Record<string, { status: string; label: string; icon: string }> = {
  accepted: { status: "preparing", label: "Start Preparing", icon: "flame-outline" },
  preparing: { status: "ready", label: "Mark Ready", icon: "checkmark-circle-outline" },
  ready: { status: "picked_up", label: "Pick Up", icon: "bag-handle-outline" },
  picked_up: { status: "delivering", label: "Start Delivery", icon: "car-outline" },
  delivering: { status: "delivered", label: "Mark Delivered", icon: "checkmark-done-outline" },
};

interface CoffeeOrder {
  id: string;
  orderType: string;
  coffeeName: string;
  coffeeSize: string;
  quantity: number;
  status: string;
  totalAmount: string;
  currency: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  giftMessage?: string;
  recipientName?: string;
  createdAt: string;
}

export default function DriverCoffeeOrdersScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabMode>("available");
  const [refreshing, setRefreshing] = useState(false);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["/api/coffee/driver/orders", { status: tab === "available" ? "available" : "mine" }],
    queryFn: async () => {
      return apiRequest(`/api/coffee/driver/orders?status=${tab === "available" ? "available" : "mine"}`);
    },
    refetchInterval: 10000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/coffee/driver/orders/${orderId}/accept`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coffee/driver/orders"] });
      Alert.alert("Accepted", "You've accepted this coffee order.");
    },
    onError: (e: any) => Alert.alert("Error", e.message || "Failed to accept"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest(`/api/coffee/driver/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coffee/driver/orders"] });
    },
    onError: (e: any) => Alert.alert("Error", e.message || "Failed to update"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/coffee/driver/orders"] });
    setRefreshing(false);
  }, [queryClient]);

  const orders: CoffeeOrder[] = ordersData?.orders || [];

  const renderOrder = useCallback(({ item, index }: { item: CoffeeOrder; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] || theme.textMuted;
    const nextAction = NEXT_STATUS[item.status];

    return (
      <View>
        <View style={[styles.orderCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.orderHeader}>
            <View style={styles.orderTitleRow}>
              <Ionicons name="cafe" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.orderName, { color: theme.text }]}>
                {item.coffeeName}
              </ThemedText>
              <View style={[styles.typeBadge, { backgroundColor: statusColor + "20" }]}>
                <ThemedText style={{ ...Typography.captionBold, color: statusColor }}>
                  {item.orderType.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "15" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ThemedText style={{ ...Typography.captionBold, color: statusColor }}>
                {STATUS_LABELS[item.status] || item.status}
              </ThemedText>
            </View>
          </View>

          <View style={styles.orderDetails}>
            <View style={styles.detailRow}>
              <ThemedText style={{ ...Typography.labelHeavy, color: theme.textSecondary }}>
                Size: {item.coffeeSize} | Qty: {item.quantity}
              </ThemedText>
              <ThemedText style={{ ...Typography.labelHeavy, color: theme.text }}>
                {parseFloat(item.totalAmount).toFixed(2)} {item.currency}
              </ThemedText>
            </View>

            {item.specialInstructions ? (
              <ThemedText style={{ ...Typography.small, color: theme.textMuted, marginTop: 4 }} numberOfLines={2}>
                Note: {item.specialInstructions}
              </ThemedText>
            ) : null}

            {item.deliveryAddress ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <ThemedText style={{ ...Typography.small, color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
                  {item.deliveryAddress}
                </ThemedText>
              </View>
            ) : null}

            {item.giftMessage ? (
              <View style={[styles.giftMessageBox, { backgroundColor: theme.error + "10", borderColor: theme.error + "30" }]}>
                <Ionicons name="gift-outline" size={14} color={theme.error} />
                <ThemedText style={{ ...Typography.small, color: theme.error, flex: 1 }}>
                  {item.recipientName ? `To: ${item.recipientName} - ` : ""}{item.giftMessage}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.orderActions}>
            {tab === "available" && item.status === "pending" ? (
              <Pressable
                onPress={() => acceptMutation.mutate(item.id)}
                disabled={acceptMutation.isPending}
                style={[styles.actionButton, { backgroundColor: Colors.travonyGreen }]}
              >
                {acceptMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.light.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.light.textOnPrimary} />
                    <ThemedText style={styles.actionButtonText}>Accept Order</ThemedText>
                  </>
                )}
              </Pressable>
            ) : null}

            {tab === "my_orders" && nextAction ? (
              <Pressable
                onPress={() => updateStatusMutation.mutate({ orderId: item.id, status: nextAction.status })}
                disabled={updateStatusMutation.isPending}
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
              >
                {updateStatusMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.light.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name={nextAction.icon as any} size={18} color={Colors.light.textOnPrimary} />
                    <ThemedText style={styles.actionButtonText}>{nextAction.label}</ThemedText>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }, [tab, theme, acceptMutation, updateStatusMutation]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cafe-outline" size={48} color={theme.textMuted} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          {tab === "available" ? "No Available Orders" : "No Orders Yet"}
        </ThemedText>
        <ThemedText style={{ color: theme.textSecondary, ...Typography.labelLight, textAlign: "center" }}>
          {tab === "available"
            ? "New coffee orders from riders will appear here."
            : "Orders you accept will show up here."}
        </ThemedText>
      </View>
    );
  }, [isLoading, tab, theme]);

  return (
    <ThemedView style={styles.container}>
      <View style={{ paddingTop: headerHeight + Spacing.sm, paddingHorizontal: Spacing.lg }}>
        <View style={[styles.tabRow, { backgroundColor: theme.backgroundSecondary }]}>
          <Pressable
            onPress={() => setTab("available")}
            style={[styles.tabButton, tab === "available" ? { backgroundColor: theme.primary } : null]}
          >
            <ThemedText style={{ color: tab === "available" ? theme.textOnPrimary : theme.text, ...Typography.labelBold }}>
              Available
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setTab("my_orders")}
            style={[styles.tabButton, tab === "my_orders" ? { backgroundColor: theme.primary } : null]}
          >
            <ThemedText style={{ color: tab === "my_orders" ? theme.textOnPrimary : theme.text, ...Typography.labelBold }}>
              My Orders
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: Spacing.md,
            paddingBottom: tabBarInset + Spacing["3xl"],
            paddingHorizontal: Spacing.lg,
            flexGrow: 1,
          }}
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  orderCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    marginBottom: Spacing.md,
  },
  orderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  orderName: {
    ...Typography.h4Heavy,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  orderDetails: {
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  giftMessageBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  orderActions: {
    borderTopWidth: 0,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: Colors.light.textOnPrimary,
    ...Typography.bodyHeavy,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3Heavy,
  },
});
