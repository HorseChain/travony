import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type AuthMode = "login" | "register" | "driver";

export default function AuthScreen() {
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  const isLogin = authMode === "login";
  const isDriver = authMode === "driver";

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      let endpoint = "/api/auth/login";
      let body: any = { email, password };
      
      if (authMode === "register") {
        endpoint = "/api/auth/register";
        body = { email, password, name, phone };
      } else if (authMode === "driver") {
        endpoint = "/api/auth/register-driver";
        body = { email, password, name, phone, licenseNumber };
      }
      
      const response = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      if (response.user && response.token) {
        await login(response.user, response.token);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("/api/auth/guest", {
        method: "POST",
      });
      if (response.user && response.token) {
        await login(response.user, response.token);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Guest login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText style={styles.appName}>Travony</ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            Your ride, your way
          </ThemedText>
        </View>

        <View style={styles.formContainer}>
          <ThemedText style={styles.title}>
            {isLogin ? "Welcome Back" : isDriver ? "Become a Driver" : "Create Account"}
          </ThemedText>

          {!isLogin && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Full Name"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!isLogin && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Phone Number (optional)"
              placeholderTextColor={theme.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          )}

          {isDriver && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Driver License Number"
              placeholderTextColor={theme.textMuted}
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              autoCapitalize="characters"
            />
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {isLogin ? "Sign In" : isDriver ? "Register as Driver" : "Create Account"}
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textMuted }]}>or</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleGuestLogin}
            disabled={isLoading}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
              Continue as Guest
            </ThemedText>
          </Pressable>

          <Pressable
            style={styles.switchButton}
            onPress={() => setAuthMode(isLogin ? "register" : "login")}
          >
            <ThemedText style={[styles.switchText, { color: theme.textSecondary }]}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <ThemedText style={[styles.switchTextBold, { color: theme.primary }]}>
                {isLogin ? "Sign Up" : "Sign In"}
              </ThemedText>
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.switchButton, { marginTop: Spacing.md }]}
            onPress={() => setAuthMode(isDriver ? "register" : "driver")}
          >
            <ThemedText style={[styles.switchText, { color: theme.textSecondary }]}>
              {isDriver ? "Register as customer instead? " : "Want to earn as a driver? "}
              <ThemedText style={[styles.switchTextBold, { color: theme.primary }]}>
                {isDriver ? "Customer Sign Up" : "Become a Driver"}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.terms, { color: theme.textMuted }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </ThemedText>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
  },
  appName: {
    ...Typography.h1,
    marginTop: Spacing.lg,
  },
  tagline: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  formContainer: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    ...Typography.body,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  primaryButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing["2xl"],
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...Typography.small,
    marginHorizontal: Spacing.lg,
  },
  secondaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...Typography.button,
  },
  switchButton: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
  },
  switchText: {
    ...Typography.body,
  },
  switchTextBold: {
    fontWeight: "600",
  },
  terms: {
    ...Typography.small,
    textAlign: "center",
  },
});
