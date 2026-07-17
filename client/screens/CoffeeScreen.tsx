import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Typography, Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type OrderType = "order" | "buy" | "gift";
type CoffeeSize = "small" | "medium" | "large";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  currency: string;
  description: string;
}

const SIZE_MULTIPLIERS: Record<CoffeeSize, number> = {
  small: 0.8,
  medium: 1.0,
  large: 1.3,
};

const SIZE_LABELS: Record<CoffeeSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
};

const ORDER_TYPE_CONFIG: Record<OrderType, { label: string; icon: string; description: string; color: string }> = {
  order: { label: "Order", icon: "cafe-outline", description: "Get coffee delivered to you", color: Colors.travonyGreen },
  buy: { label: "Buy", icon: "cart-outline", description: "Pick up at a hub", color: Colors.light.warning },
  gift: { label: "Gift", icon: "gift-outline", description: "Send coffee to someone", color: Colors.light.error },
};

const CATEGORY_ICONS: Record<string, string> = {
  coffee: "cafe",
  tea: "leaf",
  iced: "snow",
  specialty: "star",
  other: "ellipse",
};

export default function CoffeeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"type" | "menu" | "customize" | "confirm">("type");
  const [orderType, setOrderType] = useState<OrderType>("order");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [size, setSize] = useState<CoffeeSize>("medium");
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ["/api/coffee/menu"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest("/api/coffee/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coffee/orders"] });
      Alert.alert("Order Placed", "Your coffee order has been submitted. A driver will pick it up soon.");
      resetOrder();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to place order");
    },
  });

  const resetOrder = useCallback(() => {
    setStep("type");
    setSelectedItem(null);
    setSize("medium");
    setQuantity(1);
    setSpecialInstructions("");
    setGiftMessage("");
    setRecipientName("");
    setRecipientPhone("");
  }, []);

  const menu: MenuItem[] = menuData?.menu || [];
  const categories = useMemo(() => {
    const cats: Record<string, MenuItem[]> = {};
    for (const item of menu) {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push(item);
    }
    return cats;
  }, [menu]);

  const itemPrice = useMemo(() => {
    if (!selectedItem) return 0;
    return Math.round(selectedItem.basePrice * SIZE_MULTIPLIERS[size] * 100) / 100;
  }, [selectedItem, size]);

  const deliveryFee = orderType === "buy" ? 0 : 5;
  const totalAmount = Math.round((itemPrice * quantity + deliveryFee) * 100) / 100;

  const handleSelectType = (type: OrderType) => {
    setOrderType(type);
    setStep("menu");
  };

  const handleSelectItem = (item: MenuItem) => {
    setSelectedItem(item);
    setStep("customize");
  };

  const handlePlaceOrder = () => {
    if (!selectedItem) return;

    if (orderType === "gift" && !recipientPhone) {
      Alert.alert("Missing Info", "Please enter the recipient's phone number.");
      return;
    }

    createOrderMutation.mutate({
      orderType,
      coffeeName: selectedItem.id,
      coffeeSize: size,
      quantity,
      specialInstructions: specialInstructions || undefined,
      giftMessage: orderType === "gift" ? giftMessage : undefined,
      recipientName: orderType === "gift" ? recipientName : undefined,
      recipientPhone: orderType === "gift" ? recipientPhone : undefined,
      paymentMethod: "card",
    });
  };

  const renderTypeSelection = () => (
    <View style={styles.typeSection}>
      <View style={styles.typeHeader}>
        <View style={[styles.coffeeBigIcon, { backgroundColor: theme.primary + "15" }]}>
          <Ionicons name="cafe" size={48} color={theme.primary} />
        </View>
        <ThemedText style={[styles.typeTitle, { color: theme.text }]}>
          Travony Coffee
        </ThemedText>
        <ThemedText style={[styles.typeSubtitle, { color: theme.textSecondary }]}>
          Fresh coffee delivered by Travony drivers
        </ThemedText>
      </View>

      {(Object.entries(ORDER_TYPE_CONFIG) as [OrderType, typeof ORDER_TYPE_CONFIG[OrderType]][]).map(([type, config], index) => (
        <View key={type}>
          <Pressable
            onPress={() => handleSelectType(type)}
            style={[styles.typeCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <View style={[styles.typeCardIcon, { backgroundColor: config.color + "15" }]}>
              <Ionicons name={config.icon as any} size={28} color={config.color} />
            </View>
            <View style={styles.typeCardContent}>
              <ThemedText style={[styles.typeCardTitle, { color: theme.text }]}>
                {config.label}
              </ThemedText>
              <ThemedText style={[styles.typeCardDesc, { color: theme.textSecondary }]}>
                {config.description}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  );

  const renderMenu = () => {
    if (menuLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>Loading menu...</ThemedText>
        </View>
      );
    }

    return (
      <View>
        <Pressable onPress={() => setStep("type")} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
          <ThemedText style={{ color: theme.primary, fontWeight: "600", marginLeft: 6 }}>
            Back
          </ThemedText>
        </Pressable>

        <View style={[styles.orderTypeBadge, { backgroundColor: ORDER_TYPE_CONFIG[orderType].color + "15" }]}>
          <Ionicons name={ORDER_TYPE_CONFIG[orderType].icon as any} size={16} color={ORDER_TYPE_CONFIG[orderType].color} />
          <ThemedText style={{ color: ORDER_TYPE_CONFIG[orderType].color, ...Typography.labelBold }}>
            {ORDER_TYPE_CONFIG[orderType].label} Mode
          </ThemedText>
        </View>

        {Object.entries(categories).map(([category, items]) => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Ionicons name={(CATEGORY_ICONS[category] || "ellipse") as any} size={16} color={theme.primary} />
              <ThemedText style={[styles.categoryTitle, { color: theme.text }]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </ThemedText>
            </View>
            {items.map((item, idx) => (
              <View key={item.id}>
                <Pressable
                  onPress={() => handleSelectItem(item)}
                  style={[styles.menuItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                >
                  <View style={styles.menuItemInfo}>
                    <ThemedText style={[styles.menuItemName, { color: theme.text }]}>
                      {item.name}
                    </ThemedText>
                    <ThemedText style={[styles.menuItemDesc, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.description}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.menuItemPrice, { color: theme.primary }]}>
                    {item.basePrice} {item.currency}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderCustomize = () => {
    if (!selectedItem) return null;

    return (
      <View>
        <Pressable onPress={() => setStep("menu")} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
          <ThemedText style={{ color: theme.primary, fontWeight: "600", marginLeft: 6 }}>
            Back to Menu
          </ThemedText>
        </Pressable>

        <View style={[styles.selectedItemCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={[styles.selectedItemName, { color: theme.text }]}>
            {selectedItem.name}
          </ThemedText>
          <ThemedText style={[styles.selectedItemDesc, { color: theme.textSecondary }]}>
            {selectedItem.description}
          </ThemedText>
        </View>

        <ThemedText style={[styles.customLabel, { color: theme.text }]}>Size</ThemedText>
        <View style={styles.sizeRow}>
          {(["small", "medium", "large"] as CoffeeSize[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSize(s)}
              style={[
                styles.sizeButton,
                {
                  backgroundColor: size === s ? theme.primary : theme.backgroundDefault,
                  borderColor: size === s ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText style={{
                color: size === s ? theme.textOnPrimary : theme.text,
                ...Typography.bodySmallHeavy,
              }}>
                {SIZE_LABELS[s]}
              </ThemedText>
              <ThemedText style={{
                color: size === s ? theme.textOnPrimary : theme.textMuted,
                ...Typography.caption,
              }}>
                {s}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={[styles.customLabel, { color: theme.text }]}>Quantity</ThemedText>
        <View style={styles.quantityRow}>
          <Pressable
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            style={[styles.quantityButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Ionicons name="remove" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.quantityValue, { color: theme.text }]}>{quantity}</ThemedText>
          <Pressable
            onPress={() => setQuantity(Math.min(10, quantity + 1))}
            style={[styles.quantityButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Ionicons name="add" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ThemedText style={[styles.customLabel, { color: theme.text }]}>Special Instructions</ThemedText>
        <TextInput
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          placeholder="Extra hot, no sugar, oat milk..."
          placeholderTextColor={theme.textMuted}
          style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
          multiline
        />

        {orderType === "gift" ? (
          <>
            <ThemedText style={[styles.customLabel, { color: theme.text }]}>Recipient Details</ThemedText>
            <TextInput
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Recipient name"
              placeholderTextColor={theme.textMuted}
              style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
            />
            <TextInput
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="Recipient phone number"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text, marginTop: Spacing.sm }]}
            />
            <TextInput
              value={giftMessage}
              onChangeText={setGiftMessage}
              placeholder="Add a message (optional)"
              placeholderTextColor={theme.textMuted}
              style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text, marginTop: Spacing.sm }]}
              multiline
            />
          </>
        ) : null}

        <View style={[styles.priceSummary, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.priceRow}>
            <ThemedText style={{ color: theme.textSecondary, ...Typography.bodyMedium }}>
              {selectedItem.name} ({size}) x{quantity}
            </ThemedText>
            <ThemedText style={{ color: theme.text, ...Typography.bodyBold }}>
              {(itemPrice * quantity).toFixed(2)} AED
            </ThemedText>
          </View>
          {deliveryFee > 0 ? (
            <View style={styles.priceRow}>
              <ThemedText style={{ color: theme.textSecondary, ...Typography.bodyMedium }}>
                Delivery Fee
              </ThemedText>
              <ThemedText style={{ color: theme.text, ...Typography.bodyBold }}>
                {deliveryFee.toFixed(2)} AED
              </ThemedText>
            </View>
          ) : (
            <View style={styles.priceRow}>
              <ThemedText style={{ color: Colors.travonyGreen, ...Typography.bodyMedium }}>
                Pickup - No delivery fee
              </ThemedText>
            </View>
          )}
          <View style={[styles.priceDivider, { backgroundColor: theme.border }]} />
          <View style={styles.priceRow}>
            <ThemedText style={{ color: theme.text, ...Typography.h4Heavy }}>
              Total
            </ThemedText>
            <ThemedText style={{ color: theme.primary, ...Typography.h4Heavy }}>
              {totalAmount.toFixed(2)} AED
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={handlePlaceOrder}
          disabled={createOrderMutation.isPending}
          style={[styles.placeOrderButton, { backgroundColor: theme.primary, opacity: createOrderMutation.isPending ? 0.5 : 1 }]}
        >
          {createOrderMutation.isPending ? (
            <ActivityIndicator size="small" color={theme.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="cafe" size={18} color={theme.textOnPrimary} />
              <ThemedText style={styles.placeOrderText}>
                Place {ORDER_TYPE_CONFIG[orderType].label} - {totalAmount.toFixed(2)} AED
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === "type" ? renderTypeSelection() : null}
        {step === "menu" ? renderMenu() : null}
        {step === "customize" || step === "confirm" ? renderCustomize() : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
  },
  typeSection: {
    gap: Spacing.md,
  },
  typeHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  coffeeBigIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  typeTitle: {
    ...Typography.xxlHeavy,
    marginBottom: 4,
  },
  typeSubtitle: {
    ...Typography.bodyMedium,
    textAlign: "center",
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  typeCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardContent: {
    flex: 1,
  },
  typeCardTitle: {
    ...Typography.bodyLargeHeavy,
    marginBottom: 2,
  },
  typeCardDesc: {
    ...Typography.labelLight,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  orderTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: 6,
    marginBottom: Spacing.lg,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  categoryTitle: {
    ...Typography.h4Heavy,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    ...Typography.bodySmallBold,
    marginBottom: 2,
  },
  menuItemDesc: {
    ...Typography.small,
  },
  menuItemPrice: {
    ...Typography.bodyHeavy,
    marginLeft: Spacing.md,
  },
  selectedItemCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  selectedItemName: {
    ...Typography.xlHeavy,
    marginBottom: 4,
  },
  selectedItemDesc: {
    ...Typography.bodyMedium,
  },
  customLabel: {
    ...Typography.bodyBold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sizeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  sizeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  quantityValue: {
    ...Typography.xlHeavy,
    minWidth: 30,
    textAlign: "center",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.bodyMedium,
    minHeight: 44,
  },
  priceSummary: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  priceDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  placeOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  placeOrderText: {
    color: Colors.light.textOnPrimary,
    ...Typography.h4Heavy,
  },
});
