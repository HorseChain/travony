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
      answer: "Make sure you're online and in an active service area. Ride requests will appear automatically when customers nearby request a ride. Accept quickly to secure the trip!",
    },
    {
      question: "When do I get paid?",
      answer: "Earnings from completed rides are added to your wallet immediately. You can withdraw to your bank account anytime when your balance exceeds AED 50. Payouts are processed within 2-3 business days.",
    },
    {
      question: "What if a customer cancels?",
      answer: "If a customer cancels after you've arrived at the pickup location, you may receive a cancellation fee. The fee depends on wait time and distance traveled.",
    },
    {
      question: "How are fares calculated?",
      answer: "Fares include a base fare, distance-based charge, and time-based charge. During high demand, dynamic pricing may apply (capped at 1.5x). You receive 90% of each fare.",
    },
    {
      question: "How do I update my vehicle information?",
      answer: "Go to Profile > Vehicle Details to update your vehicle information. Make sure to keep your documents current for uninterrupted service.",
    },
    {
      question: "What if I have an issue during a ride?",
      answer: "For emergencies, contact local authorities immediately. For ride-related issues, you can report them through the app after completing the ride or contact our support team.",
    },
  ];

  const handleEmailSupport = () => {
    Linking.openURL("mailto:driver-support@travony.com?subject=Driver Support Request");
  };

  const handleCallSupport = () => {
    if (Platform.OS === "web") {
      window.alert("Phone: +971 4 XXX XXXX");
    } else {
      Linking.openURL("tel:+97142345678");
    }
  };

  const handleWhatsApp = () => {
    Linking.openURL("https://wa.me/971501234567?text=Hi, I need help with my Travony driver account");
  };

  const supportOptions: SupportOption[] = [
    {
      icon: "mail-outline",
      label: "Email Support",
      subtitle: "driver-support@travony.com",
      onPress: handleEmailSupport,
    },
    {
      icon: "call-outline",
      label: "Call Us",
      subtitle: "Available 24/7",
      onPress: handleCallSupport,
    },
    {
      icon: "logo-whatsapp",
      label: "WhatsApp",
      subtitle: "Quick responses",
      onPress: handleWhatsApp,
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
            For life-threatening emergencies, please call 999 (Police) or 998 (Ambulance) immediately.
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
