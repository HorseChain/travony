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

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export default function EmergencyContactsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: contacts = [], isLoading } = useQuery<EmergencyContact[]>({
    queryKey: [`/api/emergency-contacts/${user?.id}`],
    enabled: !!user?.id,
  });

  const addContactMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/emergency-contacts", {
        method: "POST",
        body: JSON.stringify({
          userId: user?.id,
          name,
          phone,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/emergency-contacts/${user?.id}`] });
      setShowAddForm(false);
      setName("");
      setPhone("");
      Alert.alert("Success", "Emergency contact added successfully");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to add contact");
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/emergency-contacts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/emergency-contacts/${user?.id}`] });
    },
  });

  const handleAddContact = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    addContactMutation.mutate();
  };

  const handleDeleteContact = (id: string) => {
    Alert.alert(
      "Remove Contact",
      "Are you sure you want to remove this emergency contact?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteContactMutation.mutate(id),
        },
      ]
    );
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
        data={contacts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <>
            <Card style={StyleSheet.flatten([styles.infoCard, { backgroundColor: theme.warning + "15" }])}>
              <View style={styles.infoRow}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.warning} />
                <ThemedText style={[styles.infoText, { color: theme.warning }]}>
                  Emergency contacts will be notified when you use the panic button during a ride.
                </ThemedText>
              </View>
            </Card>

            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { borderColor: theme.primary, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setShowAddForm(!showAddForm)}
            >
              <Ionicons name={showAddForm ? "close-outline" : "add-outline"} size={20} color={theme.primary} />
              <ThemedText style={[styles.addButtonText, { color: theme.primary }]}>
                {showAddForm ? "Cancel" : "Add Emergency Contact"}
              </ThemedText>
            </Pressable>

            {showAddForm && (
              <Card style={styles.formCard}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Contact name"
                  placeholderTextColor={theme.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Phone number"
                  placeholderTextColor={theme.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: addContactMutation.isPending ? 0.7 : pressed ? 0.9 : 1,
                    },
                  ]}
                  onPress={handleAddContact}
                  disabled={addContactMutation.isPending}
                >
                  {addContactMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Add Contact</ThemedText>
                  )}
                </Pressable>
              </Card>
            )}
          </>
        )}
        renderItem={({ item }) => (
          <Card style={styles.contactCard}>
            <View style={styles.contactRow}>
              <View style={[styles.avatarContainer, { backgroundColor: theme.error + "20" }]}>
                <Ionicons name="person-outline" size={20} color={theme.error} />
              </View>
              <View style={styles.contactInfo}>
                <ThemedText style={styles.contactName}>{item.name}</ThemedText>
                <ThemedText style={[styles.contactPhone, { color: theme.textSecondary }]}>
                  {item.phone}
                </ThemedText>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteContact(item.id)}
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
                <Ionicons name="people-outline" size={40} color={theme.textMuted} />
              </View>
              <ThemedText style={styles.emptyTitle}>No Emergency Contacts</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add trusted contacts who can be notified in case of emergency
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
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    ...Typography.bodyMedium,
    flex: 1,
    marginLeft: Spacing.md,
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
  contactCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "600",
  },
  contactPhone: {
    ...Typography.bodyMedium,
    marginTop: Spacing.xs,
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
