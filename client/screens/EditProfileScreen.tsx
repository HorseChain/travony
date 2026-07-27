import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();

  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [bio, setBio] = useState<string | null>(null);
  const [bioTouched, setBioTouched] = useState(false);

  const socialQuery = useQuery<{ followers: number; following: number; bio: string | null }>({
    queryKey: ["/api/social/counts"],
  });
  const savedBio = socialQuery.data?.bio || "";
  const bioValue = bioTouched ? bio || "" : savedBio;

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/users/${user?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, phone, avatar, bio: bioValue.trim() }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: async (data) => {
      await updateUser({ name, phone, avatar });
      queryClient.invalidateQueries({ queryKey: ["/api/social/counts"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].endsWith("/social-context"),
      });
      Alert.alert("Success", "Profile updated successfully");
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update profile");
    },
  });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to change your photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    updateProfileMutation.mutate();
  };

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
        <View style={styles.avatarSection}>
          <Pressable style={styles.avatarContainer} onPress={handlePickImage}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="person-outline" size={48} color={theme.primary} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera-outline" size={14} color={Colors.light.textOnPrimary} />
            </View>
          </Pressable>
          <ThemedText style={[styles.changePhotoText, { color: theme.primary }]}>
            Change Photo
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              ]}
            >
              <Ionicons name="person-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your name"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons name="mail-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.textMuted }]}
                value={user?.email || ""}
                editable={false}
              />
            </View>
            <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
              Email cannot be changed
            </ThemedText>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Phone Number</ThemedText>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              ]}
            >
              <Ionicons name="call-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your phone number"
                placeholderTextColor={theme.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Bio</ThemedText>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              ]}
            >
              <Ionicons name="text-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Add a short bio (optional)"
                placeholderTextColor={theme.textMuted}
                value={bioValue}
                onChangeText={(text) => {
                  setBioTouched(true);
                  setBio(text);
                }}
                maxLength={80}
              />
            </View>
            <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
              {`${bioValue.length}/80 — shown on your profile`}
            </ThemedText>
          </View>

        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: theme.primary,
              opacity: updateProfileMutation.isPending ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={updateProfileMutation.isPending}
        >
          {updateProfileMutation.isPending ? (
            <ActivityIndicator color={Colors.light.textOnPrimary} />
          ) : (
            <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
          )}
        </Pressable>
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
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: {
    ...Typography.bodySmallMedium,
    marginTop: Spacing.md,
  },
  form: {
    marginBottom: Spacing["2xl"],
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodyBold,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.body,
  },
  helperText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  saveButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    ...Typography.button,
    color: Colors.light.textOnPrimary,
  },
});
