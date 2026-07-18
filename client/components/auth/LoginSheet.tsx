import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import { APP_VARIANT, getAppDisplayName } from "@/lib/appVariant";

WebBrowser.maybeCompleteAuthSession();

interface PhoneCode {
  code: string;
  phoneCode: string;
  name: string;
}

type SheetStep = "options" | "phone" | "otp" | "name";
type UserRole = "customer" | "driver";

export function LoginSheet() {
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const { sheetVisible, sheetMode, closeLoginSheet } = useAuthGate();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"login" | "signup" | null>(null);
  const [step, setStep] = useState<SheetStep>("options");
  const [userRole, setUserRole] = useState<UserRole>(
    APP_VARIANT === "driver" ? "driver" : "customer",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<PhoneCode>({
    code: "AE",
    phoneCode: "+971",
    name: "United Arab Emirates",
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const activeMode = mode ?? sheetMode;
  const appName = getAppDisplayName();

  const { data: phoneCodes = [] } = useQuery<PhoneCode[]>({
    queryKey: ["/api/phone-codes"],
    enabled: sheetVisible && showCountryPicker,
  });

  const filteredCountries = phoneCodes.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.phoneCode.includes(countrySearch),
  );

  const resetAndClose = () => {
    closeLoginSheet();
    setStep("options");
    setMode(null);
    setPhone("");
    setOtp(["", "", "", "", "", ""]);
    setName("");
    setSessionToken("");
    setIsLoading(false);
    setGoogleLoading(false);
  };

  const completeLogin = async (user: any, token: string) => {
    await login(user, token);
    resetAndClose();
  };

  const getFullPhoneNumber = () => {
    const cleaned = phone.replace(/[\s-]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    return `${selectedCountry.phoneCode}${cleaned}`;
  };

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
    const digits = value.replace(/\D/g, "");
    if (digits.length > 1) {
      const newOtp = ["", "", "", "", "", ""];
      for (let i = 0; i < 6 && i < digits.length; i++) {
        newOtp[i] = digits[i];
      }
      setOtp(newOtp);
      const nextEmpty = newOtp.findIndex((d) => d === "");
      if (nextEmpty === -1) {
        otpRefs.current[5]?.blur();
        handleVerifyOTP(newOtp.join(""));
      } else {
        otpRefs.current[nextEmpty]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < 5) {
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
      const response = await apiRequest("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone: getFullPhoneNumber(), otp: otpCode }),
        headers: { "Content-Type": "application/json" },
      });
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (response.isNewUser) {
          setSessionToken(response.sessionToken);
          setStep("name");
        } else {
          await completeLogin(response.user, response.token);
        }
      }
    } catch (error: any) {
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

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const statusRes = await fetch(new URL("/api/auth/google/status", getApiUrl()).toString());
      const status = await statusRes.json().catch(() => ({ configured: false }));
      if (!status.configured) {
        Alert.alert(
          "Google sign-in unavailable",
          "Google sign-in is not set up yet. Please use your phone number instead.",
        );
        return;
      }

      const redirectUri = Linking.createURL("google-auth");
      const startUrl = new URL("/api/auth/google/start", getApiUrl());
      startUrl.searchParams.set("redirect_uri", redirectUri);
      startUrl.searchParams.set("role", userRole);

      const result = await WebBrowser.openAuthSessionAsync(
        startUrl.toString(),
        redirectUri,
      );
      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }
      if (result.type !== "success" || !result.url) {
        Alert.alert(
          "Google sign-in",
          "Sign-in did not complete. Make sure you allow Travony to open in your browser and try again.",
        );
        return;
      }
      const parsed = Linking.parse(result.url);
      const params = (parsed.queryParams || {}) as Record<string, string>;
      if (params.gauth === "error") {
        Alert.alert("Google sign-in", params.message || "Google sign-in failed. Please try again.");
        return;
      }
      const token = params.token;
      if (params.gauth !== "success" || !token) {
        Alert.alert("Google sign-in", "Sign-in did not complete. Please try again.");
        return;
      }

      const meRes = await fetch(new URL("/api/auth/me", getApiUrl()).toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) {
        Alert.alert("Google sign-in", "Could not finish signing you in. Please try again.");
        return;
      }
      const me = await meRes.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await completeLogin(me.user, token);
    } catch (error: any) {
      Alert.alert("Google sign-in", error?.message || "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleHelp = () => {
    Alert.alert(
      "Need help?",
      activeMode === "signup"
        ? `Create your ${appName} account with your phone number or your Google account. It only takes a moment.`
        : `Log in with the phone number or Google account you used when you joined ${appName}.`,
    );
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === "otp") setStep("phone");
    else if (step === "phone" || step === "name") setStep("options");
  };

  const optionRowStyle = ({ pressed }: { pressed: boolean }) => [
    styles.optionRow,
    {
      backgroundColor: isDark ? theme.backgroundElevated : "#F1F1F2",
      opacity: pressed ? 0.7 : 1,
    },
  ];

  const renderOptions = () => (
    <View style={styles.optionsContainer}>
      <ThemedText style={styles.sheetTitle}>
        {activeMode === "signup" ? `Sign up for ${appName}` : `Log in to ${appName}`}
      </ThemedText>

      <View style={styles.optionsList}>
        <Pressable style={optionRowStyle} onPress={() => setStep("phone")}>
          <Ionicons name="person" size={20} color={theme.text} style={styles.optionIcon} />
          <ThemedText style={styles.optionLabel}>Use phone number</ThemedText>
        </Pressable>

        <Pressable style={optionRowStyle} onPress={handleGoogle} disabled={googleLoading}>
          {googleLoading ? (
            <ActivityIndicator size="small" color={theme.text} style={styles.optionIcon} />
          ) : (
            <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.optionIcon} />
          )}
          <ThemedText style={styles.optionLabel}>Continue with Google</ThemedText>
        </Pressable>
      </View>

      {APP_VARIANT === "unified" ? (
        <Pressable
          style={styles.roleToggle}
          onPress={() => {
            Haptics.selectionAsync();
            setUserRole(userRole === "driver" ? "customer" : "driver");
          }}
        >
          <ThemedText style={[styles.roleToggleText, { color: theme.textSecondary }]}>
            {userRole === "driver"
              ? "Joining as a driver · Switch to rider"
              : "Driving with Travony? Continue as driver"}
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.termsWrap}>
        <ThemedText style={[styles.termsText, { color: theme.textSecondary }]}>
          By continuing, you agree to our{" "}
          <ThemedText style={[styles.termsLink, { color: theme.text }]}>Terms of Service</ThemedText>{" "}
          and acknowledge that you have read our{" "}
          <ThemedText style={[styles.termsLink, { color: theme.text }]}>Privacy Policy</ThemedText>.
        </ThemedText>
      </View>
    </View>
  );

  const renderCountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <View style={[styles.pickerOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.pickerContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.pickerHeader}>
            <ThemedText style={styles.pickerTitle}>Select Country</ThemedText>
            <Pressable onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
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
                  item.code === selectedCountry.code && {
                    backgroundColor: Colors.travonyGreen + "20",
                  },
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
    <View style={styles.stepContainer}>
      {renderCountryPicker()}
      <ThemedText style={styles.stepTitle}>Enter your number</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        We'll send you a verification code
      </ThemedText>
      <View style={styles.phoneInputContainer}>
        <Pressable
          style={[
            styles.countryCode,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
          onPress={() => setShowCountryPicker(true)}
        >
          <ThemedText style={styles.countryCodeText}>{selectedCountry.phoneCode}</ThemedText>
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </Pressable>
        <TextInput
          style={[
            styles.phoneInput,
            { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
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
          { backgroundColor: Colors.travonyGreen, opacity: pressed || !phone ? 0.5 : 1 },
        ]}
        onPress={handleSendOTP}
        disabled={isLoading || !phone}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.light.textOnPrimary} />
        ) : (
          <ThemedText style={styles.primaryButtonText}>Send Code</ThemedText>
        )}
      </Pressable>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>Verify your number</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        Enter the 6-digit code sent to {getFullPhoneNumber()}
      </ThemedText>
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              otpRefs.current[index] = ref;
            }}
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
      <Pressable style={styles.resendButton} onPress={handleSendOTP} disabled={isLoading}>
        <ThemedText style={[styles.resendText, { color: Colors.travonyGreen }]}>
          Resend Code
        </ThemedText>
      </Pressable>
      {isLoading ? (
        <ActivityIndicator color={Colors.travonyGreen} style={{ marginTop: Spacing.xl }} />
      ) : null}
    </View>
  );

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>What's your name?</ThemedText>
      <ThemedText style={[styles.stepDescription, { color: theme.textSecondary }]}>
        {userRole === "driver" ? "This is shown to riders" : "This helps drivers identify you"}
      </ThemedText>
      <TextInput
        style={[
          styles.nameInput,
          { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
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
          { backgroundColor: Colors.travonyGreen, opacity: pressed || !name.trim() ? 0.5 : 1 },
        ]}
        onPress={handleNameSubmit}
        disabled={isLoading || !name.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.light.textOnPrimary} />
        ) : (
          <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
        )}
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={sheetVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={resetAndClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={resetAndClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            {step === "options" ? (
              <Pressable style={styles.headerButton} onPress={handleHelp} disabled={isLoading}>
                <Ionicons name="help-circle-outline" size={26} color={theme.text} />
              </Pressable>
            ) : (
              <Pressable style={styles.headerButton} onPress={handleBack} disabled={isLoading}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </Pressable>
            )}
            <Pressable style={styles.headerButton} onPress={resetAndClose} disabled={isLoading}>
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === "options" ? renderOptions() : null}
            {step === "phone" ? renderPhoneStep() : null}
            {step === "otp" ? renderOtpStep() : null}
            {step === "name" ? renderNameStep() : null}
          </KeyboardAwareScrollViewCompat>

          {step === "options" ? (
            <View
              style={[
                styles.footerBar,
                {
                  borderTopColor: theme.border,
                  backgroundColor: isDark ? theme.backgroundElevated : "#F8F8F8",
                },
              ]}
            >
              <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
                {activeMode === "signup" ? "Already have an account? " : "Don't have an account? "}
              </ThemedText>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setMode(activeMode === "signup" ? "login" : "signup");
                }}
              >
                <ThemedText style={[styles.footerLink, { color: Colors.travonyGreen }]}>
                  {activeMode === "signup" ? "Log in" : "Sign up"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    height: "88%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerButton: {
    padding: Spacing.xs,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
  },
  optionsContainer: {
    flex: 1,
    paddingTop: Spacing["3xl"] + Spacing.xl,
  },
  sheetTitle: {
    ...Typography.h1,
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  optionsList: {
    gap: Spacing.md,
  },
  optionRow: {
    height: 52,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  optionIcon: {
    position: "absolute",
    left: Spacing.lg,
  },
  optionLabel: {
    ...Typography.h4,
  },
  roleToggle: {
    marginTop: Spacing.xl,
    alignItems: "center",
    padding: Spacing.sm,
  },
  roleToggleText: {
    ...Typography.small,
  },
  termsWrap: {
    marginTop: "auto",
    paddingVertical: Spacing.xl,
  },
  termsText: {
    ...Typography.small,
    textAlign: "center",
    lineHeight: 18,
  },
  termsLink: {
    ...Typography.small,
    fontWeight: "600",
  },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    ...Typography.body,
  },
  footerLink: {
    ...Typography.body,
    fontWeight: "700",
  },
  stepContainer: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
  },
  stepTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  stepDescription: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
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
    ...Typography.h4,
  },
  phoneInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
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
    color: Colors.light.textOnPrimary,
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
    ...Typography.h4,
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
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerContent: {
    height: "70%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  pickerTitle: {
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
    ...Typography.h4,
  },
});
