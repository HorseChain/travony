import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import { APP_VARIANT, getAppDisplayName } from "@/lib/appVariant";

interface PhoneCode {
  code: string;
  phoneCode: string;
  name: string;
}

type OnboardingStep = "perspective" | "role" | "location" | "phone" | "otp" | "name";
type UserRole = "customer" | "driver";

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const getInitialStep = (): OnboardingStep => {
    return "perspective";
  };
  
  const getInitialRole = (): UserRole => {
    if (APP_VARIANT === 'driver') return 'driver';
    return 'customer';
  };

  const [step, setStep] = useState<OnboardingStep>(getInitialStep);
  const [userRole, setUserRole] = useState<UserRole>(getInitialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<PhoneCode>({ code: "AE", phoneCode: "+971", name: "United Arab Emirates" });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const { data: phoneCodes = [] } = useQuery<PhoneCode[]>({
    queryKey: ["/api/phone-codes"],
  });

  const filteredCountries = phoneCodes.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.phoneCode.includes(countrySearch)
  );

  const handleLocationPermission = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep("phone");
    } catch (error) {
      Alert.alert("Error", "Failed to request location permission");
    } finally {
      setIsLoading(false);
    }
  };

  const getFullPhoneNumber = () => `${selectedCountry.phoneCode}${phone}`;

  const handleSendOTP = async () => {
    if (!phone || phone.length < 6) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: getFullPhoneNumber() }),
        headers: { "Content-Type": "application/json" },
      });

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep("otp");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== "")) {
      handleVerifyOTP(newOtp.join(""));
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode: string) => {
    setIsLoading(true);
    try {
      console.log("Verifying OTP for phone:", getFullPhoneNumber());
      const response = await apiRequest("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone: getFullPhoneNumber(), otp: otpCode }),
        headers: { "Content-Type": "application/json" },
      });

      console.log("OTP verification response:", JSON.stringify(response));

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (response.isNewUser) {
          console.log("New user, going to name step");
          setSessionToken(response.sessionToken);
          setStep("name");
        } else {
          console.log("Existing user, completing login with user:", JSON.stringify(response.user));
          console.log("Token present:", !!response.token);
          await completeLogin(response.user, response.token);
          console.log("Login completed successfully");
        }
      }
    } catch (error: any) {
      console.error("OTP verification error:", error);
      Alert.alert("Error", error.message || "Invalid verification code");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("/api/auth/complete-registration", {
        method: "POST",
        body: JSON.stringify({ sessionToken, name: name.trim(), role: userRole }),
        headers: { "Content-Type": "application/json" },
      });

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await completeLogin(response.user, response.token);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete registration");
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = async (user: any, token: string) => {
    await login(user, token);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const stepOrder: OnboardingStep[] = ["perspective", "location", "phone", "otp", "name"];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  const canGoBack = () => {
    return step !== "perspective" && !isLoading;
  };

  const handlePerspectiveSelect = (role: UserRole) => {
    setUserRole(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("location");
  };

  const handleRoleSelect = (role: UserRole) => {
    setUserRole(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("location");
  };

  const getPerspectiveHeadline = () => {
    if (APP_VARIANT === 'driver') return 'Your vehicle is an asset.';
    if (APP_VARIANT === 'rider') return 'Movement has value.';
    return 'Movement has value.';
  };

  const getPerspectiveSubtext = () => {
    if (APP_VARIANT === 'driver') return 'Activate your vehicle on the Travony Network.';
    if (APP_VARIANT === 'rider') return 'Welcome to the Travony Mobility Network.';
    return 'Welcome to the Travony Mobility Network.';
  };

  const renderPerspectiveStep = () => (
    <Animated.View entering={FadeIn.duration(800)} exiting={FadeOut.duration(300)} style={styles.perspectiveContainer}>
      <View style={styles.perspectiveContent}>
        <Animated.View entering={FadeIn.delay(300).duration(1000)}>
          <ThemedText style={styles.perspectiveHeadline}>
            {getPerspectiveHeadline()}
          </ThemedText>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(1000).duration(800)}>
          <ThemedText style={styles.perspectiveSubtext}>
            {getPerspectiveSubtext()}
          </ThemedText>
        </Animated.View>
      </View>
      <Animated.View entering={FadeIn.delay(1500).duration(800)} style={styles.perspectiveButtons}>
        {(APP_VARIANT === 'driver' || APP_VARIANT === 'unified') ? (
          <Pressable
            style={({ pressed }) => [
              styles.perspectiveButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() => handlePerspectiveSelect("driver")}
          >
            <ThemedText style={styles.perspectiveButtonText}>Activate Your Vehicle</ThemedText>
          </Pressable>
        ) : null}
        {(APP_VARIANT === 'rider' || APP_VARIANT === 'unified') ? (
          <Pressable
            style={({ pressed }) => [
              styles.perspectiveButton,
              APP_VARIANT === 'unified' ? styles.perspectiveButtonSecondary : {},
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() => handlePerspectiveSelect("customer")}
          >
            <ThemedText style={APP_VARIANT === 'unified' ? styles.perspectiveButtonTextSecondary : styles.perspectiveButtonText}>
              Access the Network
            </ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );

  const renderRoleStep = () => (
    <Animated.View entering={FadeIn} exiting={SlideOutLeft} style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name="car" size={64} color={Colors.travonyGreen} />
      </View>
      <ThemedText style={styles.stepTitle}>Welcome to {getAppDisplayName()}</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        How would you like to use {getAppDisplayName()}?
      </ThemedText>
      <View style={styles.roleButtonsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.roleButton,
            { backgroundColor: Colors.travonyGreen, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => handleRoleSelect("customer")}
        >
          <Ionicons name="person" size={32} color="#FFFFFF" style={{ marginBottom: 8 }} />
          <ThemedText style={styles.roleButtonTitle}>Access the Network</ThemedText>
          <ThemedText style={styles.roleButtonSubtitle}>Intelligent mobility</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.roleButton,
            { backgroundColor: theme.backgroundElevated, borderWidth: 2, borderColor: Colors.travonyGreen, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => handleRoleSelect("driver")}
        >
          <Ionicons name="car-sport" size={32} color={Colors.travonyGreen} style={{ marginBottom: 8 }} />
          <ThemedText style={[styles.roleButtonTitle, { color: theme.text }]}>Activate Your Vehicle</ThemedText>
          <ThemedText style={[styles.roleButtonSubtitle, { color: theme.textSecondary }]}>Vehicle as asset</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderLocationStep = () => (
    <Animated.View entering={FadeIn} exiting={SlideOutLeft} style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name="location" size={64} color={Colors.travonyGreen} />
      </View>
      <ThemedText style={styles.stepTitle}>Enable Location</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        Location access enables intelligent vehicle matching and network optimization
      </ThemedText>
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: Colors.travonyGreen, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={handleLocationPermission}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.primaryButtonText}>Enable Location</ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );

  const renderCountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Country</ThemedText>
            <Pressable onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="Search country..."
            placeholderTextColor={theme.textMuted}
            value={countrySearch}
            onChangeText={setCountrySearch}
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.countryItem,
                  { borderBottomColor: theme.border },
                  item.code === selectedCountry.code && { backgroundColor: Colors.travonyGreen + "20" },
                ]}
                onPress={() => {
                  setSelectedCountry(item);
                  setShowCountryPicker(false);
                  setCountrySearch("");
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText style={styles.countryName}>{item.name}</ThemedText>
                <ThemedText style={[styles.countryPhoneCode, { color: theme.textSecondary }]}>
                  {item.phoneCode}
                </ThemedText>
              </Pressable>
            )}
            style={styles.countryList}
          />
        </View>
      </View>
    </Modal>
  );

  const renderPhoneStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      {renderCountryPicker()}
      <View style={[styles.iconContainer, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name="call" size={64} color={Colors.travonyGreen} />
      </View>
      <ThemedText style={styles.stepTitle}>Enter Your Number</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        We'll send you a verification code
      </ThemedText>

      <View style={styles.phoneInputContainer}>
        <Pressable
          style={[styles.countryCode, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={() => setShowCountryPicker(true)}
        >
          <ThemedText style={styles.countryCodeText}>{selectedCountry.phoneCode}</ThemedText>
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </Pressable>
        <TextInput
          style={[
            styles.phoneInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Phone number"
          placeholderTextColor={theme.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={15}
          autoFocus
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: Colors.travonyGreen, opacity: pressed || !phone ? 0.6 : 1 },
        ]}
        onPress={handleSendOTP}
        disabled={isLoading || !phone}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.primaryButtonText}>Send Code</ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );

  const renderOtpStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name="shield-checkmark" size={64} color={Colors.travonyGreen} />
      </View>
      <ThemedText style={styles.stepTitle}>Verify Your Number</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        Enter the 6-digit code sent to {getFullPhoneNumber()}
      </ThemedText>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { otpRefs.current[index] = ref; }}
            style={[
              styles.otpInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: digit ? Colors.travonyGreen : theme.border,
              },
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
            keyboardType="number-pad"
            maxLength={1}
            autoFocus={index === 0}
          />
        ))}
      </View>

      <Pressable
        style={styles.resendButton}
        onPress={handleSendOTP}
        disabled={isLoading}
      >
        <ThemedText style={[styles.resendText, { color: Colors.travonyGreen }]}>
          Resend Code
        </ThemedText>
      </Pressable>

      {isLoading && <ActivityIndicator color={Colors.travonyGreen} style={{ marginTop: Spacing.xl }} />}
    </Animated.View>
  );

  const renderNameStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name="person" size={64} color={Colors.travonyGreen} />
      </View>
      <ThemedText style={styles.stepTitle}>What's Your Name?</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        This helps drivers identify you
      </ThemedText>

      <TextInput
        style={[
          styles.nameInput,
          {
            backgroundColor: theme.backgroundDefault,
            color: theme.text,
            borderColor: theme.border,
          },
        ]}
        placeholder="Your full name"
        placeholderTextColor={theme.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoFocus
      />

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: Colors.travonyGreen, opacity: pressed || !name.trim() ? 0.6 : 1 },
        ]}
        onPress={handleNameSubmit}
        disabled={isLoading || !name.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );

  return (
    <ThemedView style={[styles.container, step === "perspective" && { backgroundColor: "#000000" }]}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["2xl"] }]}>
        {canGoBack() && step !== "perspective" && (
          <Pressable 
            style={[styles.backButton, { top: insets.top + Spacing.md }]} 
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
        )}
        {step !== "perspective" ? (
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText style={styles.appName}>Travony</ThemedText>
          </View>
        ) : null}

        <View style={styles.stepContent}>
          {step === "perspective" && renderPerspectiveStep()}
          {step === "role" && renderRoleStep()}
          {step === "location" && renderLocationStep()}
          {step === "phone" && renderPhoneStep()}
          {step === "otp" && renderOtpStep()}
          {step === "name" && renderNameStep()}
        </View>

        {step !== "perspective" ? (
          <View style={styles.progressContainer}>
            {["location", "phone", "otp", "name"].map((s, index) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor:
                      ["location", "phone", "otp", "name"].indexOf(step) >= index
                        ? Colors.travonyGreen
                        : theme.border,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
  },
  backButton: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 10,
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
  },
  appName: {
    ...Typography.h2,
    marginTop: Spacing.sm,
    color: Colors.travonyGreen,
  },
  stepContent: {
    flex: 1,
    justifyContent: "center",
  },
  stepContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  stepTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  stepDescription: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing["3xl"],
    lineHeight: 22,
  },
  primaryButton: {
    width: "100%",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  phoneInputContainer: {
    flexDirection: "row",
    width: "100%",
    marginBottom: Spacing["2xl"],
    gap: Spacing.sm,
  },
  countryCode: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  countryCodeText: {
    ...Typography.body,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "70%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
  },
  searchInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    ...Typography.body,
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  countryName: {
    ...Typography.body,
    flex: 1,
  },
  countryPhoneCode: {
    ...Typography.body,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    textAlign: "center",
    ...Typography.h2,
  },
  resendButton: {
    padding: Spacing.md,
  },
  resendText: {
    ...Typography.body,
    fontWeight: "600",
  },
  nameInput: {
    width: "100%",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing["2xl"],
    ...Typography.body,
  },
  skipButton: {
    marginTop: Spacing["2xl"],
    padding: Spacing.md,
  },
  skipText: {
    ...Typography.body,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleButtonsContainer: {
    width: "100%",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  roleButton: {
    width: "100%",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  roleButtonTitle: {
    ...Typography.h3,
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  roleButtonSubtitle: {
    ...Typography.small,
    color: "rgba(255, 255, 255, 0.8)",
  },
  perspectiveContainer: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  perspectiveContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  perspectiveHeadline: {
    fontSize: 32,
    fontWeight: "200",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 1.5,
    lineHeight: 44,
    marginBottom: Spacing["2xl"],
  },
  perspectiveSubtext: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.35)",
    textAlign: "center",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  perspectiveButtons: {
    width: "100%",
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  perspectiveButton: {
    width: "100%",
    height: 54,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  perspectiveButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  perspectiveButtonSecondary: {
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  perspectiveButtonTextSecondary: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
