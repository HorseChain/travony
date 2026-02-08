import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

let StripeCardField: any = null;
let useConfirmSetupIntentHook: any = null;
if (Platform.OS !== "web") {
  try {
    const stripeModule = require("@stripe/stripe-react-native");
    StripeCardField = stripeModule.CardField;
    useConfirmSetupIntentHook = stripeModule.useConfirmSetupIntent;
  } catch (e) {}
}

function useStripeSetupIntent() {
  if (useConfirmSetupIntentHook) {
    return useConfirmSetupIntentHook();
  }
  return { confirmSetupIntent: null };
}

export default function AddPaymentMethodScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { confirmSetupIntent } = useStripeSetupIntent();

  const [cardComplete, setCardComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState<any>(null);

  const handleAddCard = async () => {
    if (Platform.OS === "web" || !confirmSetupIntent) {
      Alert.alert("Not Available", "Card setup is only available in the mobile app. Please use Expo Go on your device.");
      return;
    }

    if (!cardComplete) {
      Alert.alert("Incomplete", "Please fill in all card details.");
      return;
    }

    setIsProcessing(true);

    try {
      const setupResponse = await apiRequest("/api/payments/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!setupResponse?.clientSecret) {
        throw new Error("Could not initiate card setup. Please try again.");
      }

      const { setupIntent, error } = await confirmSetupIntent(setupResponse.clientSecret, {
        paymentMethodType: "Card",
      });

      if (error) {
        throw new Error(error.message || "Card verification failed.");
      }

      if (!setupIntent?.paymentMethodId) {
        throw new Error("Card could not be verified. Please try again.");
      }

      await apiRequest("/api/payments/add-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: setupIntent.paymentMethodId,
          last4: cardDetails?.last4 || null,
          brand: cardDetails?.brand || null,
          isDefault: true,
        }),
      });

      queryClient.invalidateQueries({ queryKey: [`/api/payment-methods/${user?.id}`] });
      Alert.alert("Card Added", "Your card has been securely saved for future payments.");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add card. Please try again.");
    } finally {
      setIsProcessing(false);
    }
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
            {cardDetails?.last4 ? `**** **** **** ${cardDetails.last4}` : "**** **** **** ****"}
          </ThemedText>
          <View style={styles.cardDetails}>
            <View>
              <ThemedText style={styles.cardLabel}>BRAND</ThemedText>
              <ThemedText style={styles.cardValue}>
                {cardDetails?.brand || "CARD"}
              </ThemedText>
            </View>
            <View>
              <ThemedText style={styles.cardLabel}>EXPIRES</ThemedText>
              <ThemedText style={styles.cardValue}>
                {cardDetails?.expiryMonth && cardDetails?.expiryYear
                  ? `${String(cardDetails.expiryMonth).padStart(2, "0")}/${String(cardDetails.expiryYear).slice(-2)}`
                  : "MM/YY"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <ThemedText style={styles.label}>Card Information</ThemedText>
          <View style={[styles.cardFieldContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            {StripeCardField ? (
              <StripeCardField
                postalCodeEnabled={false}
                placeholders={{
                  number: "4242 4242 4242 4242",
                }}
                cardStyle={{
                  backgroundColor: "transparent",
                  textColor: theme.text,
                  placeholderColor: theme.textMuted,
                  borderWidth: 0,
                  fontSize: 16,
                }}
                style={styles.cardField}
                onCardChange={(details: any) => {
                  setCardComplete(details.complete);
                  setCardDetails(details);
                }}
              />
            ) : (
              <View style={[styles.cardField, { justifyContent: "center", alignItems: "center" }]}>
                <ThemedText style={{ color: theme.textMuted, textAlign: "center" }}>
                  Card entry is available in the mobile app.{"\n"}Please use Expo Go on your device.
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.cardFieldHint, { color: theme.textMuted }]}>
            Your card information is securely processed by Stripe. We never store your full card details.
          </ThemedText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: cardComplete ? theme.primary : theme.textMuted,
              opacity: isProcessing ? 0.7 : pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleAddCard}
          disabled={isProcessing || !cardComplete}
        >
          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <ThemedText style={[styles.submitButtonText, { marginLeft: Spacing.sm }]}>
                Verifying Card...
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.submitButtonText}>Add Card</ThemedText>
          )}
        </Pressable>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.success} />
          <ThemedText style={[styles.securityText, { color: theme.textMuted }]}>
            PCI DSS Level 1 compliant. Payments powered by Stripe.
          </ThemedText>
        </View>

        <View style={styles.acceptedCards}>
          <ThemedText style={[styles.acceptedLabel, { color: theme.textMuted }]}>
            Accepted cards
          </ThemedText>
          <View style={styles.cardLogos}>
            <View style={[styles.cardLogo, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.cardLogoText, { color: theme.text }]}>VISA</ThemedText>
            </View>
            <View style={[styles.cardLogo, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.cardLogoText, { color: theme.text }]}>MC</ThemedText>
            </View>
            <View style={[styles.cardLogo, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.cardLogoText, { color: theme.text }]}>AMEX</ThemedText>
            </View>
          </View>
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
  label: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  cardFieldContainer: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardField: {
    width: "100%",
    height: 50,
  },
  cardFieldHint: {
    ...Typography.small,
    marginTop: Spacing.sm,
    lineHeight: 18,
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
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
    gap: Spacing.sm,
  },
  securityText: {
    ...Typography.small,
  },
  acceptedCards: {
    alignItems: "center",
  },
  acceptedLabel: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  cardLogos: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cardLogo: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  cardLogoText: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
