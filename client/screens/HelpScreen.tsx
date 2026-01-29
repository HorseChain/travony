import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const faqs = [
  {
    question: "How do I book a ride?",
    answer: "Open the app, enter your pickup and drop-off locations, select your preferred vehicle type, and tap 'Find a Ride'. Once a driver accepts, you'll see their details and can track their arrival.",
  },
  {
    question: "How is my fare calculated?",
    answer: "Your fare is calculated based on base fare, distance traveled, and time taken. Surge pricing may apply during peak hours. You can see the estimated fare before confirming your ride.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept credit/debit cards, cash, and Travony wallet balance. You can add or change your payment method from the Wallet tab.",
  },
  {
    question: "How can I cancel a ride?",
    answer: "You can cancel a ride from the active ride screen before the driver arrives. Cancellation charges may apply based on our cancellation policy.",
  },
  {
    question: "What is the OTP for?",
    answer: "The OTP (One-Time Password) is a security feature. Share it with your driver at pickup to verify you're entering the correct vehicle.",
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const handleCall = () => {
    Linking.openURL("tel:+1234567890").catch(() => {
      Alert.alert("Unable to Call", "Phone calling is not available on this device.");
    });
  };

  const handleEmail = () => {
    Linking.openURL("mailto:support@travony.com").catch(() => {
      Alert.alert("Unable to Email", "Email is not configured on this device.");
    });
  };

  const handleWebsite = () => {
    Linking.openURL("https://travony.com").catch(() => {
      Alert.alert("Unable to Open", "Could not open the website.");
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card style={styles.contactCard}>
        <ThemedText style={styles.sectionTitle}>Contact Us</ThemedText>
        
        <Pressable
          style={({ pressed }) => [
            styles.contactRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleCall}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="call-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.contactInfo}>
            <ThemedText style={styles.contactLabel}>Phone Support</ThemedText>
            <ThemedText style={[styles.contactValue, { color: theme.primary }]}>
              +1 (234) 567-890
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Pressable
          style={({ pressed }) => [
            styles.contactRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleEmail}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="mail-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.contactInfo}>
            <ThemedText style={styles.contactLabel}>Email Support</ThemedText>
            <ThemedText style={[styles.contactValue, { color: theme.primary }]}>
              support@travony.com
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Pressable
          style={({ pressed }) => [
            styles.contactRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleWebsite}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="globe-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.contactInfo}>
            <ThemedText style={styles.contactLabel}>Website</ThemedText>
            <ThemedText style={[styles.contactValue, { color: theme.primary }]}>
              www.travony.com
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
        </Pressable>
      </Card>

      <ThemedText style={styles.faqTitle}>Frequently Asked Questions</ThemedText>

      {faqs.map((faq, index) => (
        <Card key={index} style={styles.faqCard}>
          <ThemedText style={styles.faqQuestion}>{faq.question}</ThemedText>
          <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>
            {faq.answer}
          </ThemedText>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contactCard: {
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.lg,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  iconContainer: {
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
  contactLabel: {
    ...Typography.small,
    opacity: 0.7,
  },
  contactValue: {
    ...Typography.body,
    fontWeight: "500",
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
    marginLeft: 60,
  },
  faqTitle: {
    ...Typography.h4,
    marginBottom: Spacing.lg,
  },
  faqCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  faqQuestion: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  faqAnswer: {
    ...Typography.bodyMedium,
    lineHeight: 22,
  },
});
