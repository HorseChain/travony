import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export default function SavedAddressesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");

  const { data: addresses = [], isLoading } = useQuery<SavedAddress[]>({
    queryKey: [`/api/saved-addresses/${user?.id}`],
    enabled: !!user?.id,
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/saved-addresses", {
        method: "POST",
        body: JSON.stringify({
          userId: user?.id,
          label,
          address,
          lat: "25.2048",
          lng: "55.2708",
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/saved-addresses/${user?.id}`] });
      setShowAddForm(false);
      setLabel("");
      setAddress("");
      Alert.alert("Success", "Address saved successfully");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to save address");
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/saved-addresses/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/saved-addresses/${user?.id}`] });
    },
  });

  const handleAddAddress = () => {
    if (!label.trim() || !address.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    addAddressMutation.mutate();
  };

  const handleDeleteAddress = (id: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteAddressMutation.mutate(id),
        },
      ]
    );
  };

  const getIcon = (label: string): keyof typeof Ionicons.glyphMap => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("home")) return "home";
    if (lowerLabel.includes("work") || lowerLabel.includes("office")) return "briefcase";
    return "location-outline";
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        data={addresses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { borderColor: theme.primary, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setShowAddForm(!showAddForm)}
            >
              <Ionicons name={showAddForm ? "close-outline" : "add-outline"} size={20} color={theme.primary} />
              <ThemedText style={[styles.addButtonText, { color: theme.primary }]}>
                {showAddForm ? "Cancel" : "Add New Address"}
              </ThemedText>
            </Pressable>

            {showAddForm && (
              <Card style={styles.formCard}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Label (e.g., Home, Work)"
                  placeholderTextColor={theme.textMuted}
                  value={label}
                  onChangeText={setLabel}
                />
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Full address"
                  placeholderTextColor={theme.textMuted}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: addAddressMutation.isPending ? 0.7 : pressed ? 0.9 : 1,
                    },
                  ]}
                  onPress={handleAddAddress}
                  disabled={addAddressMutation.isPending}
                >
                  {addAddressMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Save Address</ThemedText>
                  )}
                </Pressable>
              </Card>
            )}
          </>
        )}
        renderItem={({ item }) => (
          <Card style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name={getIcon(item.label)} size={20} color={theme.primary} />
              </View>
              <View style={styles.addressInfo}>
                <View style={styles.labelRow}>
                  <ThemedText style={styles.addressLabel}>{item.label}</ThemedText>
                  {item.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: theme.primary + "20" }]}>
                      <ThemedText style={[styles.defaultText, { color: theme.primary }]}>
                        Default
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.address}
                </ThemedText>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteAddress(item.id)}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={() =>
          !showAddForm && (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="location-outline" size={40} color={theme.textMuted} />
              </View>
              <ThemedText style={styles.emptyTitle}>No Saved Addresses</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add your frequently used addresses for quicker booking
              </ThemedText>
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: Spacing.lg,
  },
  addButtonText: {
    ...Typography.button,
    marginLeft: Spacing.sm,
  },
  formCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    ...Typography.body,
  },
  saveButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  addressCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  addressInfo: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  addressLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  defaultBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  defaultText: {
    ...Typography.small,
    fontWeight: "600",
  },
  addressText: {
    ...Typography.bodyMedium,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    paddingHorizontal: Spacing["3xl"],
  },
});
