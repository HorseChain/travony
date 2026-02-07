import { View, StyleSheet, ScrollView, Pressable, Linking, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface FAQ {
  question: string;
  answer: string;
}

interface SupportOption {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
}

export default function DriverHelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const faqs: FAQ[] = [
    {
      question: "How do I receive ride requests?",
      answer: "Make sure you're online and in an active service area. Ride requests will appear automatically when customers nearby request a ride. Our Intent-Based Mobility system matches you with riders whose direction and preferences align with yours, leading to better trips and fewer cancellations.",
    },
    {
      question: "When do I get paid?",
      answer: "Earnings from completed rides are added to your wallet immediately. You can withdraw to your bank account or as USDT cryptocurrency anytime when your balance exceeds AED 50. Bank payouts are processed within 2-3 business days. Tips from riders go 100% to you with no platform cut.",
    },
    {
      question: "What if a customer cancels?",
      answer: "If a customer cancels after you've arrived at the pickup location, you will receive a cancellation fee. The fee depends on your wait time and distance traveled. Our Trust-First framework ensures fair protection for drivers against cancellations that aren't your fault.",
    },
    {
      question: "How are fares calculated?",
      answer: "Fares include a base fare, distance-based charge, and time-based charge. During high demand, dynamic pricing may apply (capped based on the city's launch phase). You receive 90% of each fare - Travony only takes a flat 10% platform fee. You always see the full earnings breakdown before accepting a ride.",
    },
    {
      question: "How do I update my vehicle information?",
      answer: "Go to Profile > Vehicle Details to update your vehicle information. Our AI Vehicle Verification system will review your photos and can provide instant approval. Make sure to keep your documents current for uninterrupted service.",
    },
    {
      question: "What if I have an issue during a ride?",
      answer: "For emergencies, contact local authorities immediately (999 for Police, 998 for Ambulance). For ride-related issues, you can report them through the app after completing the ride or email driver-support@travony.com.",
    },
    {
      question: "What is 'Pay Me to Go Home' mode?",
      answer: "When heading home, activate 'Going Home' mode. The system will only send you ride requests from passengers going in your direction. You earn an additional 80% of the direction premium that riders pay for the 'Faster Pickup' option. This feature has built-in protections against misuse.",
    },
    {
      question: "What is Ghost Mode?",
      answer: "Ghost Mode lets you accept and complete rides even without internet. It uses Bluetooth mesh networking to connect with nearby riders. Fares are pre-calculated from cached pricing. Once you're back online, rides automatically sync for payment processing. This is especially useful in areas with unreliable connectivity.",
    },
    {
      question: "What is the Ride Truth Engine?",
      answer: "The Ride Truth Engine is a crowd-sourced reliability scoring system. Both riders and drivers can log their experiences on any platform. Scores are based on price accuracy, pickup reliability, cancellation rates, route integrity, and support quality. Your participation is voluntary and all data is anonymous.",
    },
    {
      question: "How does driver trust protection work?",
      answer: "New drivers receive Trust Protection during their first rides. This includes guaranteed minimum earnings, priority in matching, and protection against unfair ratings. As you complete more rides, you can progress to City Champion status for additional benefits and recognition.",
    },
  ];

  const handleEmailSupport = () => {
    Linking.openURL("mailto:driver-support@travony.com?subject=T Driver Support Request");
  };

  const handleWebsite = () => {
    Linking.openURL("https://travony.replit.app/support");
  };

  const supportOptions: SupportOption[] = [
    {
      icon: "mail-outline",
      label: "Email Support",
      subtitle: "driver-support@travony.com",
      onPress: handleEmailSupport,
    },
    {
      icon: "globe-outline",
      label: "Support Center",
      subtitle: "travony.replit.app/support",
      onPress: handleWebsite,
    },
  ];

  const renderFAQ = (faq: FAQ, index: number) => {
    const isExpanded = expandedFAQ === index;
    return (
      <Pressable
        key={index}
        style={[
          styles.faqItem,
          index < faqs.length - 1 && styles.faqItemBorder,
          { borderBottomColor: theme.border },
        ]}
        onPress={() => setExpandedFAQ(isExpanded ? null : index)}
      >
        <View style={styles.faqHeader}>
          <ThemedText style={styles.faqQuestion}>{faq.question}</ThemedText>
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
      </Pressable>
    );
  };

  const renderSupportOption = (option: SupportOption, index: number) => (
    <Pressable
      key={index}
      style={[styles.supportOption, { backgroundColor: theme.backgroundElevated }]}
      onPress={option.onPress}
    >
      <View style={[styles.supportIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name={option.icon} size={24} color={Colors.travonyGreen} />
      </View>
      <View style={styles.supportContent}>
        <ThemedText style={styles.supportLabel}>{option.label}</ThemedText>
        <ThemedText style={[styles.supportSubtitle, { color: theme.textSecondary }]}>
          {option.subtitle}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Contact Support</ThemedText>
          <View style={styles.supportGrid}>
            {supportOptions.map(renderSupportOption)}
          </View>
          <View style={[styles.responseTimeCard, { backgroundColor: theme.backgroundElevated }]}>
            <View style={[styles.supportIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
              <Ionicons name="time-outline" size={24} color={Colors.travonyGreen} />
            </View>
            <View style={styles.supportContent}>
              <ThemedText style={styles.supportLabel}>Response Time</ThemedText>
              <ThemedText style={[styles.supportSubtitle, { color: theme.textSecondary }]}>
                Within 24 hours
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Frequently Asked Questions</ThemedText>
          <View style={[styles.faqCard, { backgroundColor: theme.backgroundElevated }]}>
            {faqs.map(renderFAQ)}
          </View>
        </View>

        <View style={[styles.emergencyCard, { backgroundColor: theme.error + "10", borderColor: theme.error + "30" }]}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning-outline" size={24} color={theme.error} />
            <ThemedText style={[styles.emergencyTitle, { color: theme.error }]}>
              Emergency?
            </ThemedText>
          </View>
          <ThemedText style={[styles.emergencyText, { color: theme.textSecondary }]}>
            For life-threatening emergencies, please call 999 (Police) or 998 (Ambulance) immediately. For non-emergency ride issues, email driver-support@travony.com.
          </ThemedText>
        </View>
      </ScrollView>
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  supportGrid: {
    gap: Spacing.md,
  },
  supportOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  responseTimeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.md,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  supportContent: {
    flex: 1,
  },
  supportLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  supportSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  faqCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  faqItem: {
    padding: Spacing.md,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
    paddingRight: Spacing.md,
  },
  faqAnswer: {
    ...Typography.body,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  emergencyCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  emergencyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  emergencyTitle: {
    ...Typography.h4,
  },
  emergencyText: {
    ...Typography.body,
    lineHeight: 22,
  },
});
