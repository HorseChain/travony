import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export default function AddPaymentMethodScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted.slice(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/payment-methods", {
        method: "POST",
        body: JSON.stringify({
          userId: user?.id,
          type: "card",
          last4: cardNumber.replace(/\s/g, "").slice(-4),
          brand: "Visa",
          isDefault: true,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/payment-methods/${user?.id}`] });
      Alert.alert("Success", "Payment method added successfully");
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to add payment method");
    },
  });

  const handleSubmit = () => {
    if (!cardNumber || !expiryDate || !cvv || !cardName) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (cardNumber.replace(/\s/g, "").length !== 16) {
      Alert.alert("Error", "Please enter a valid card number");
      return;
    }
    addPaymentMutation.mutate();
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={[styles.cardPreview, { backgroundColor: theme.primary }]}>
          <View style={styles.cardChip} />
          <ThemedText style={styles.cardNumber}>
            {cardNumber || "**** **** **** ****"}
          </ThemedText>
          <View style={styles.cardDetails}>
            <View>
              <ThemedText style={styles.cardLabel}>CARD HOLDER</ThemedText>
              <ThemedText style={styles.cardValue}>
                {cardName || "YOUR NAME"}
              </ThemedText>
            </View>
            <View>
              <ThemedText style={styles.cardLabel}>EXPIRES</ThemedText>
              <ThemedText style={styles.cardValue}>
                {expiryDate || "MM/YY"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Card Number</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Ionicons name="card-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={theme.textMuted}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                keyboardType="number-pad"
                maxLength={19}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.md }]}>
              <ThemedText style={styles.label}>Expiry Date</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="MM/YY"
                  placeholderTextColor={theme.textMuted}
                  value={expiryDate}
                  onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <ThemedText style={styles.label}>CVV</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="123"
                  placeholderTextColor={theme.textMuted}
                  value={cvv}
                  onChangeText={setCvv}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Cardholder Name</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="John Doe"
                placeholderTextColor={theme.textMuted}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="words"
              />
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: addPaymentMutation.isPending ? 0.7 : pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={addPaymentMutation.isPending}
        >
          {addPaymentMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.submitButtonText}>Add Card</ThemedText>
          )}
        </Pressable>

        <View style={styles.securityNote}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.textMuted} />
          <ThemedText style={[styles.securityText, { color: theme.textMuted }]}>
            Your card information is encrypted and secure
          </ThemedText>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  cardPreview: {
    height: 200,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    marginBottom: Spacing["3xl"],
    justifyContent: "space-between",
  },
  cardChip: {
    width: 40,
    height: 30,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
  },
  cardNumber: {
    ...Typography.h3,
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  cardDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    ...Typography.small,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: Spacing.xs,
  },
  cardValue: {
    ...Typography.bodyMedium,
    color: "#FFFFFF",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  form: {
    marginBottom: Spacing["2xl"],
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.body,
  },
  row: {
    flexDirection: "row",
  },
  submitButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  submitButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  securityText: {
    ...Typography.small,
    marginLeft: Spacing.sm,
  },
});
