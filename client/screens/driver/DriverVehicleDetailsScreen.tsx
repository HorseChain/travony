import { View, StyleSheet, TextInput, Alert, Platform, TouchableOpacity, Image, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface VehicleData {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  type: string;
  photo?: string;
  photoFront?: string;
  photoSide?: string;
  verificationStatus?: "pending" | "ai_verified" | "admin_verified" | "rejected";
  aiVerificationNotes?: string;
}

interface DriverData {
  id: string;
  vehicle?: VehicleData;
  vehicles?: VehicleData[];
}

const VEHICLE_TYPES = [
  { value: "motorcycle", label: "Motorcycle", regions: ["BD", "IN", "PK"] },
  { value: "cng", label: "CNG Auto", regions: ["BD"] },
  { value: "auto_rickshaw", label: "Auto Rickshaw", regions: ["IN", "PK"] },
  { value: "economy", label: "Economy Car", regions: ["BD", "IN", "PK", "AE", "SA"] },
  { value: "comfort", label: "Comfort Car", regions: ["BD", "IN", "PK", "AE", "SA"] },
  { value: "premium", label: "Premium Car", regions: ["AE", "SA"] },
  { value: "suv", label: "SUV", regions: ["BD", "IN", "PK", "AE", "SA"] },
  { value: "minivan", label: "Minivan", regions: ["BD", "IN", "PK", "AE", "SA"] },
];

export default function DriverVehicleDetailsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("economy");
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoSide, setPhotoSide] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  const userRegion = (user as any)?.regionCode || "BD";

  const { data: driverData, isLoading } = useQuery<DriverData>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  useEffect(() => {
    if (driverData?.vehicle) {
      setMake(driverData.vehicle.make || "");
      setModel(driverData.vehicle.model || "");
      setYear(driverData.vehicle.year?.toString() || "");
      setColor(driverData.vehicle.color || "");
      setPlateNumber(driverData.vehicle.plateNumber || "");
      setVehicleType(driverData.vehicle.type || "economy");
      setPhotoFront(driverData.vehicle.photoFront || null);
      setPhotoSide(driverData.vehicle.photoSide || null);
      setVerificationStatus(driverData.vehicle.verificationStatus || null);
    }
  }, [driverData]);

  const filteredVehicleTypes = VEHICLE_TYPES.filter(
    (vt) => vt.regions.includes(userRegion) || vt.regions.length === 0
  );

  const pickImage = async (type: "front" | "side") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === "front") {
        setPhotoFront(base64Image);
      } else {
        setPhotoSide(base64Image);
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: {
      make: string;
      model: string;
      year: number;
      color: string;
      plateNumber: string;
      type: string;
      photoFront?: string;
      photoSide?: string;
      autoVerify?: boolean;
    }) => {
      return apiRequest("/api/drivers/vehicle", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/me"] });
      setIsVerifying(false);
      
      if (data?.verificationStatus) {
        setVerificationStatus(data.verificationStatus);
      }
      
      const message = data?.verificationStatus === "ai_verified"
        ? "Vehicle verified successfully by AI!"
        : data?.verificationStatus === "pending"
        ? "Vehicle saved. Pending admin review."
        : "Vehicle details updated successfully!";
      
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("Success", message);
      }
    },
    onError: () => {
      setIsVerifying(false);
      if (Platform.OS === "web") {
        alert("Failed to update vehicle details. Please try again.");
      } else {
        Alert.alert("Error", "Failed to update vehicle details. Please try again.");
      }
    },
  });

  const handleSave = (withVerification: boolean = false) => {
    if (!make || !model || !year || !color || !plateNumber) {
      if (Platform.OS === "web") {
        alert("Please fill in all fields");
      } else {
        Alert.alert("Missing Information", "Please fill in all fields");
      }
      return;
    }

    if (withVerification && !photoFront) {
      if (Platform.OS === "web") {
        alert("Please upload at least a front photo for AI verification");
      } else {
        Alert.alert("Photo Required", "Please upload at least a front photo for AI verification");
      }
      return;
    }

    setIsVerifying(withVerification);
    updateMutation.mutate({
      make,
      model,
      year: parseInt(year, 10),
      color,
      plateNumber,
      type: vehicleType,
      photoFront: photoFront || undefined,
      photoSide: photoSide || undefined,
      autoVerify: withVerification,
    });
  };

  const getVerificationBadge = () => {
    if (!verificationStatus) return null;
    
    const badgeConfig: Record<string, { color: string; icon: keyof typeof Feather.glyphMap; text: string }> = {
      ai_verified: { color: Colors.travonyGreen, icon: "check-circle", text: "AI Verified" },
      admin_verified: { color: Colors.travonyGreen, icon: "shield", text: "Admin Verified" },
      pending: { color: "#F59E0B", icon: "clock", text: "Pending Review" },
      rejected: { color: "#EF4444", icon: "x-circle", text: "Rejected" },
    };
    
    const config = badgeConfig[verificationStatus];
    if (!config) return null;
    
    return (
      <View style={[styles.verificationBadge, { backgroundColor: config.color + "20" }]}>
        <Feather name={config.icon} size={16} color={config.color} />
        <ThemedText style={[styles.badgeText, { color: config.color }]}>{config.text}</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: Colors.travonyGreen + "15" }]}>
          <ThemedText style={[styles.infoText, { color: Colors.travonyGreen }]}>
            Upload vehicle photos for AI verification to get approved faster
          </ThemedText>
        </View>

        {getVerificationBadge()}

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Vehicle Type
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            {filteredVehicleTypes.map((vt) => (
              <TouchableOpacity
                key={vt.value}
                style={[
                  styles.typeChip,
                  { 
                    backgroundColor: vehicleType === vt.value ? Colors.travonyGreen : theme.backgroundRoot,
                    borderColor: vehicleType === vt.value ? Colors.travonyGreen : theme.border,
                  },
                ]}
                onPress={() => setVehicleType(vt.value)}
              >
                <ThemedText
                  style={[
                    styles.typeChipText,
                    { color: vehicleType === vt.value ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {vt.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Vehicle Photos
          </ThemedText>
          <View style={styles.photoRow}>
            <TouchableOpacity
              style={[styles.photoBox, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
              onPress={() => pickImage("front")}
            >
              {photoFront ? (
                <Image source={{ uri: photoFront }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Feather name="camera" size={32} color={theme.textMuted} />
                  <ThemedText style={[styles.photoLabel, { color: theme.textMuted }]}>Front</ThemedText>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoBox, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
              onPress={() => pickImage("side")}
            >
              {photoSide ? (
                <Image source={{ uri: photoSide }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Feather name="camera" size={32} color={theme.textMuted} />
                  <ThemedText style={[styles.photoLabel, { color: theme.textMuted }]}>Side</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
            Clear photos help with faster AI verification
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Make
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={make}
            onChangeText={setMake}
            placeholder="e.g., Toyota, Honda, Bajaj"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Model
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={model}
            onChangeText={setModel}
            placeholder="e.g., Camry, Civic, RE"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Year
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={year}
            onChangeText={setYear}
            placeholder="e.g., 2022"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Color
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={color}
            onChangeText={setColor}
            placeholder="e.g., White, Black, Silver"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Plate Number
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={plateNumber}
            onChangeText={setPlateNumber}
            placeholder="e.g., DHAKA METRO-GA 12-3456"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
          />
        </View>

        {(isVerifying || updateMutation.isPending) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.travonyGreen} />
            <ThemedText style={{ marginTop: Spacing.md }}>
              {isVerifying ? "AI is verifying your vehicle..." : "Saving..."}
            </ThemedText>
          </View>
        )}

        <Button
          onPress={() => handleSave(true)}
          disabled={updateMutation.isPending || !photoFront}
          style={[styles.saveButton, { opacity: !photoFront ? 0.5 : 1 }]}
        >
          {updateMutation.isPending && isVerifying ? "Verifying..." : "Save & Verify with AI"}
        </Button>

        <TouchableOpacity
          onPress={() => handleSave(false)}
          disabled={updateMutation.isPending}
          style={styles.skipButton}
        >
          <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
            Save without AI verification
          </ThemedText>
        </TouchableOpacity>
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
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  infoText: {
    ...Typography.body,
    textAlign: "center",
  },
  verificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  badgeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  typeScroll: {
    marginHorizontal: -Spacing.sm,
  },
  typeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginHorizontal: Spacing.xs,
    borderWidth: 1,
  },
  typeChipText: {
    ...Typography.small,
    fontWeight: "500",
  },
  photoRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  photoBox: {
    flex: 1,
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoLabel: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  photoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  input: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  hint: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  loadingOverlay: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  skipText: {
    ...Typography.small,
  },
});
