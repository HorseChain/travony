import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert, Platform } from "react-native";
import { useMutation } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeIn, ZoomIn } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

const CATEGORIES = [
  "General",
  "Hub Experience",
  "Network Quality",
  "Vehicle Experience",
  "App Feature",
  "Safety",
];

export default function FeedbackScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/openclaw/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType: "suggestion",
          category,
          content,
          rating,
          screenName: "FeedbackScreen",
        }),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      if (Platform.OS === "web") {
        window.alert(error.message || "Failed to submit feedback. Please try again.");
      } else {
        Alert.alert("Error", error.message || "Failed to submit feedback. Please try again.");
      }
    },
  });

  const handleSubmit = () => {
    if (!category) {
      const msg = "Please select a category.";
      if (Platform.OS === "web") { window.alert(msg); } else { Alert.alert("Missing Category", msg); }
      return;
    }
    if (rating === 0) {
      const msg = "Please provide a rating.";
      if (Platform.OS === "web") { window.alert(msg); } else { Alert.alert("Missing Rating", msg); }
      return;
    }
    if (!content.trim()) {
      const msg = "Please enter your feedback.";
      if (Platform.OS === "web") { window.alert(msg); } else { Alert.alert("Missing Feedback", msg); }
      return;
    }
    mutation.mutate();
  };

  const handleReset = () => {
    setCategory("");
    setRating(0);
    setContent("");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.successContainer, { paddingTop: headerHeight + Spacing["4xl"] }]}>
          <Animated.View entering={ZoomIn.duration(500)} style={[styles.successIcon, { backgroundColor: theme.primary + "15" }]}>
            <Ionicons name="checkmark-circle" size={64} color={theme.primary} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(300).duration(400)}>
            <ThemedText style={styles.successTitle}>Thank You</ThemedText>
            <ThemedText style={[styles.successMessage, { color: theme.textSecondary }]}>
              Your feedback has been submitted successfully. We appreciate your input in improving the network.
            </ThemedText>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(600).duration(400)}>
            <Pressable
              style={({ pressed }) => [styles.resetButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={handleReset}
            >
              <ThemedText style={[styles.resetButtonText, { color: theme.buttonText }]}>Submit More Feedback</ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </ThemedView>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Animated.View entering={FadeInDown.delay(0).duration(400)}>
        <ThemedText style={styles.sectionTitle}>Category</ThemedText>
        <View style={styles.chipsContainer}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat;
            return (
              <Pressable
                key={cat}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => setCategory(cat)}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    { color: isSelected ? theme.buttonText : theme.textPrimary },
                  ]}
                >
                  {cat}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <ThemedText style={styles.sectionTitle}>Rating</ThemedText>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} style={styles.starButton}>
              <Ionicons
                name={star <= rating ? "star" : "star-outline"}
                size={36}
                color={star <= rating ? Colors.travonyGold : theme.textMuted}
              />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <ThemedText style={styles.sectionTitle}>Your Feedback</ThemedText>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.textPrimary,
              borderColor: theme.border,
            },
          ]}
          placeholder="Tell us about your experience..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={content}
          onChangeText={setContent}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed || mutation.isPending ? 0.7 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ThemedText style={[styles.submitText, { color: theme.buttonText }]}>Submitting...</ThemedText>
          ) : (
            <View style={styles.submitContent}>
              <Ionicons name="send-outline" size={20} color={theme.buttonText} />
              <ThemedText style={[styles.submitText, { color: theme.buttonText }]}>Submit Feedback</ThemedText>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
  },
  chipText: {
    ...Typography.bodyMedium,
    fontWeight: "500",
  },
  starsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
  },
  textInput: {
    minHeight: 120,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  submitButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  submitText: {
    ...Typography.button,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  successTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successMessage: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
  },
  resetButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing["2xl"],
  },
  resetButtonText: {
    ...Typography.button,
  },
});
