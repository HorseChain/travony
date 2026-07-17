import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "Rating">;
type RouteProps = RouteProp<HomeStackParamList, "Rating">;

interface Ride {
  id: string;
  status: string;
  dropoffAddress: string;
  estimatedFare: string | null;
  actualFare: string | null;
}

function ArrivedScreen({ ride }: { ride: Ride | undefined }) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const fare = ride?.actualFare || ride?.estimatedFare;

  return (
    <View style={[arrivedStyles.container, { backgroundColor: theme.primary }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim, alignItems: "center" }}>
        <View style={[arrivedStyles.checkCircle, { backgroundColor: theme.backgroundRoot }]}>
          <Ionicons name="checkmark" size={64} color={theme.primary} />
        </View>
        <ThemedText style={[arrivedStyles.title, { color: theme.textOnPrimary }]}>You've arrived</ThemedText>
        {ride?.dropoffAddress ? (
          <ThemedText style={[arrivedStyles.address, { color: theme.textOnPrimary }]} numberOfLines={2}>
            {ride.dropoffAddress}
          </ThemedText>
        ) : null}
        {fare ? (
          <ThemedText style={[arrivedStyles.fare, { color: theme.textOnPrimary }]}>AED {fare}</ThemedText>
        ) : null}
      </Animated.View>
    </View>
  );
}

const arrivedStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.md,
  },
  address: {
    ...Typography.body,
    opacity: 0.9,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  fare: {
    ...Typography.h2,
    fontWeight: "700",
    opacity: 0.95,
  },
});

export default function RatingScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const { rideId, driverId, driverName } = route.params;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState<number | null>(null);
  const [showArrived, setShowArrived] = useState(true);

  const { data: ride } = useQuery<Ride>({
    queryKey: ["/api/rides", rideId],
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowArrived(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const tipOptions = [0, 2, 5, 10];

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ratings", {
        method: "POST",
        body: JSON.stringify({
          rideId,
          toDriverId: driverId,
          rating,
          comment: comment || null,
          tip: tip || 0,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      navigation.replace("Invoice", { rideId });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to submit rating");
    },
  });

  const handleSubmit = () => {
    submitRatingMutation.mutate();
  };

  const handleSkip = () => {
    navigation.replace("Invoice", { rideId });
  };

  if (showArrived) {
    return <ArrivedScreen ride={ride} />;
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing["2xl"],
            paddingBottom: tabBarInset + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.driverAvatar, { backgroundColor: theme.backgroundDefault }]}>
            <Ionicons name="person-outline" size={48} color={theme.primary} />
          </View>
          <ThemedText style={styles.title}>Rate Your Ride</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            How was your experience with {driverName}?
          </ThemedText>
        </View>

        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              style={styles.starButton}
              onPress={() => setRating(star)}
            >
              <Ionicons
                name="star"
                size={40}
                color={star <= rating ? theme.warning : theme.border}
                style={star <= rating ? styles.starFilled : undefined}
              />
            </Pressable>
          ))}
        </View>

        <ThemedText style={[styles.ratingLabel, { color: theme.textSecondary }]}>
          {rating === 5 && "Excellent"}
          {rating === 4 && "Great"}
          {rating === 3 && "Good"}
          {rating === 2 && "Fair"}
          {rating === 1 && "Poor"}
        </ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Add a tip</ThemedText>
          <View style={styles.tipOptions}>
            {tipOptions.map((amount) => (
              <Pressable
                key={amount}
                style={({ pressed }) => [
                  styles.tipButton,
                  {
                    backgroundColor: tip === amount ? theme.primary : theme.backgroundDefault,
                    borderColor: tip === amount ? theme.primary : theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => setTip(amount)}
              >
                <ThemedText
                  style={[
                    styles.tipText,
                    { color: tip === amount ? theme.textOnPrimary : theme.text },
                  ]}
                >
                  {amount === 0 ? "No tip" : `AED ${amount}`}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Leave a comment (optional)</ThemedText>
          <TextInput
            style={[
              styles.commentInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Share your experience..."
            placeholderTextColor={theme.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: submitRatingMutation.isPending ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={submitRatingMutation.isPending}
        >
          {submitRatingMutation.isPending ? (
            <ActivityIndicator color={theme.textOnPrimary} />
          ) : (
            <ThemedText style={styles.submitButtonText}>Submit Rating</ThemedText>
          )}
        </Pressable>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <ThemedText style={[styles.skipButtonText, { color: theme.textSecondary }]}>
            Skip for now
          </ThemedText>
        </Pressable>

        <View style={styles.footprintCard}>
          <Ionicons name="leaf-outline" size={16} color={Colors.travonyGreen} />
          <ThemedText style={styles.footprintText}>Mobility Footprint Optimized</ThemedText>
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
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  driverAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  starButton: {
    padding: Spacing.sm,
  },
  starFilled: {
    transform: [{ scale: 1.1 }],
  },
  ratingLabel: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  tipOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tipButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  tipText: {
    ...Typography.bodyBold,
  },
  commentInput: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.lg,
    minHeight: 100,
    ...Typography.body,
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
    color: Colors.light.textOnPrimary,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    ...Typography.body,
  },
  footprintCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  footprintText: {
    ...Typography.caption,
    color: Colors.travonyGreen,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
