import React, { useState } from "react";
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
    answer: "Open the app, enter your pickup and drop-off locations, select your preferred vehicle type and ride priority (Fastest, Cheapest, or Most Reliable), and tap 'Find a Ride'. Our Intent-Based Mobility system will match you with the best available driver. Once a driver accepts, you'll see their details and can track their arrival in real time.",
  },
  {
    question: "How is my fare calculated?",
    answer: "Your fare is calculated based on a base fare, distance traveled, and time taken. Dynamic pricing may apply during high-demand periods (capped at 1.5x during Growth phase and 2x during Mature phase). Weather and emergency boosts may also affect pricing. You always see the guaranteed fare before confirming your ride, and it will never increase after confirmation.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept credit/debit cards via Stripe, Travony wallet balance, and USDT stablecoin cryptocurrency payments. You can manage your payment methods from the Wallet tab. All transactions are processed securely with industry-standard encryption.",
  },
  {
    question: "How can I cancel a ride?",
    answer: "You can cancel a ride from the active ride screen before the driver arrives. Cancellation charges may apply based on timing and distance. If a driver cancels on you, our Auto-Rematch system will automatically find you a new driver at the same guaranteed fare, with up to 3 rematch attempts.",
  },
  {
    question: "What is the OTP for?",
    answer: "The OTP (One-Time Password) is a security feature. Share it with your driver at pickup to verify you're entering the correct vehicle. This adds an extra layer of safety to every ride.",
  },
  {
    question: "What is the Ride Truth Engine?",
    answer: "The Ride Truth Engine lets you compare ride-hailing platforms based on real user experiences. You can log rides from any provider (Uber, Careem, Bolt, etc.) and contribute to crowd-sourced reliability scores. Each provider is scored on price accuracy, pickup reliability, cancellation rates, route integrity, and support quality. Your data is always anonymous and you can delete it at any time.",
  },
  {
    question: "What is Ghost Mode?",
    answer: "Ghost Mode enables ride-hailing even when you have no internet connection. It uses Bluetooth mesh networking to connect nearby riders and drivers. Fares are pre-calculated from cached pricing, and once you're back online, all ghost rides automatically sync with the server for payment processing and record keeping.",
  },
  {
    question: "How does the 'Pay Me to Go Home' feature work?",
    answer: "Drivers heading home can activate 'Going Home' mode. The system only sends them rides going in their direction. As a rider, you may see a 'Faster Pickup' option with a small premium for these direction-aligned drivers. The driver receives 80% of this premium.",
  },
  {
    question: "What happens if I have a fare dispute?",
    answer: "Our Fare Guardian AI system reviews disputes fairly and automatically. Go to your ride history, select the ride in question, and tap 'Report Issue'. You'll receive a resolution within 24 hours. If the dispute finds in your favour, you'll receive compensation credits directly to your wallet.",
  },
  {
    question: "How do I delete my account and data?",
    answer: "You can delete your account from Settings > Account > Delete Account in the app. You can also visit our data deletion page at https://travony.replit.app/data-deletion or email privacy@travony.com. Your data will be permanently removed within 30 days.",
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const handleEmail = () => {
    Linking.openURL("mailto:support@travony.com?subject=T Ride Support Request").catch(() => {
      Alert.alert("Unable to Email", "Email is not configured on this device.");
    });
  };

  const handleWebsite = () => {
    Linking.openURL("https://travony.replit.app/support").catch(() => {
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
            <ThemedText style={styles.contactLabel}>Support Center</ThemedText>
            <ThemedText style={[styles.contactValue, { color: theme.primary }]}>
              travony.replit.app/support
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.responseTimeRow}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="time-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.contactInfo}>
            <ThemedText style={styles.contactLabel}>Response Time</ThemedText>
            <ThemedText style={[styles.contactValue, { color: theme.textSecondary }]}>
              Within 24 hours
            </ThemedText>
          </View>
        </View>
      </Card>

      <ThemedText style={styles.faqTitle}>Frequently Asked Questions</ThemedText>

      {faqs.map((faq, index) => {
        const isExpanded = expandedFAQ === index;
        return (
          <Pressable key={index} onPress={() => setExpandedFAQ(isExpanded ? null : index)}>
            <Card style={styles.faqCard}>
              <View style={styles.faqHeader}>
                <ThemedText style={[styles.faqQuestion, { flex: 1 }]}>{faq.question}</ThemedText>
                <Ionicons
                  name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                  size={20}
                  color={theme.textMuted}
                />
              </View>
              {isExpanded ? (
                <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>
                  {faq.answer}
                </ThemedText>
              ) : null}
            </Card>
          </Pressable>
        );
      })}
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
  responseTimeRow: {
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
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    ...Typography.body,
    fontWeight: "600",
    paddingRight: Spacing.md,
  },
  faqAnswer: {
    ...Typography.bodyMedium,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
});
