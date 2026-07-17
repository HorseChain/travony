import { View, StyleSheet, TextInput, Alert, Platform, TouchableOpacity, Image, ActivityIndicator, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

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
  isElectric?: boolean;
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

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    alert(message);
  } else {
    Alert.alert(title, message);
  }
}

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
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isElectric, setIsElectric] = useState(false);

  // UI flow state
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [actionLabel, setActionLabel] = useState<string>("");
  const [rescan, setRescan] = useState(false);

  // Instant activation: measure the time from "Find my car" to activation so we
  // can show the driver exactly how fast their car became a business.
  const scanStartRef = useRef<number | null>(null);
  const [activation, setActivation] = useState<{ seconds: number; carName: string } | null>(null);

  const userRegion = (user as any)?.regionCode || "BD";

  const { data: driverData, isLoading } = useQuery<DriverData>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  const existingVehicle = driverData?.vehicle;
  const hasVehicle = !!existingVehicle;

  useEffect(() => {
    if (existingVehicle) {
      setMake(existingVehicle.make || "");
      setModel(existingVehicle.model || "");
      setYear(existingVehicle.year?.toString() || "");
      setColor(existingVehicle.color || "");
      setPlateNumber(existingVehicle.plateNumber || "");
      setVehicleType(existingVehicle.type || "economy");
      setPhotoFront(existingVehicle.photoFront || null);
      setPhotoSide(existingVehicle.photoSide || null);
      setVerificationStatus(existingVehicle.verificationStatus || null);
      setIsElectric(existingVehicle.isElectric || false);
    }
  }, [existingVehicle]);

  const filteredVehicleTypes = VEHICLE_TYPES.filter(
    (vt) => vt.regions.includes(userRegion) || vt.regions.length === 0
  );

  const applyPhoto = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets[0]?.base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPendingPhoto(base64Image);
      setShowManual(false);
      setMissingFields([]);
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notify(
          "Camera access needed",
          "Please allow camera access to photograph your car, or upload a photo from your gallery instead."
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      applyPhoto(result);
    } catch (e) {
      notify("Camera unavailable", "Couldn't open the camera here. Please upload a photo from your gallery instead.");
    }
  };

  const uploadPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      applyPhoto(result);
    } catch (e) {
      notify("Couldn't open gallery", "Please try again.");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("/api/drivers/vehicle", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/me"] });
      setPendingPhoto(null);
      setShowManual(false);
      setMissingFields([]);
      setRescan(false);

      if (data?.verificationStatus) {
        setVerificationStatus(data.verificationStatus);
      }

      // Instant activation: the AI scan approved the car AND the driver in one
      // pass. Show the celebration with the real elapsed time.
      if (data?.driverActivated) {
        const elapsedMs = scanStartRef.current ? Date.now() - scanStartRef.current : null;
        scanStartRef.current = null;
        const seconds = elapsedMs ? Math.max(1, Math.round(elapsedMs / 1000)) : 0;
        const detected = data?.aiResult?.detected;
        const activatedCar = [detected?.year, detected?.color, detected?.make, detected?.model]
          .filter(Boolean)
          .join(" ");
        setActivation({ seconds, carName: activatedCar || "Your car" });
        return;
      }
      scanStartRef.current = null;

      const message =
        data?.verificationStatus === "ai_verified"
          ? "Your car was found and verified. You're all set."
          : data?.verificationStatus === "pending"
          ? "Your car was saved. We'll finish checking it shortly."
          : "Your car details were saved.";
      notify("Done", message);
    },
    onError: (error: any) => {
      const status = error?.statusCode;
      const details = error?.details;
      if (status === 422 && details) {
        // AI found the car but couldn't read every required detail.
        const detected = details.detected || {};
        if (detected.make) setMake(detected.make);
        if (detected.model) setModel(detected.model);
        if (detected.year) setYear(String(detected.year));
        if (detected.color) setColor(detected.color);
        if (detected.plateNumber) setPlateNumber(detected.plateNumber);
        if (detected.type) setVehicleType(detected.type);
        setMissingFields(Array.isArray(details.missingFields) ? details.missingFields : []);
        setShowManual(true);
        notify(
          "Almost there",
          error?.message || "We found your car but need a couple of details. Please fill them in and save."
        );
        return;
      }
      notify("Couldn't add your car", error?.message || "Please try again.");
    },
  });

  const isBusy = saveMutation.isPending;

  const handleFindMyCar = () => {
    if (!pendingPhoto) return;
    setActionLabel("Finding your car...");
    scanStartRef.current = Date.now();
    saveMutation.mutate({ photoFront: pendingPhoto, autoVerify: true });
  };

  const handleSaveManual = () => {
    if (!make || !model || !plateNumber) {
      notify("Missing information", "Please fill in the make, model, and plate number.");
      return;
    }
    setActionLabel("Saving your car...");
    if (pendingPhoto || photoFront) {
      scanStartRef.current = Date.now();
    }
    saveMutation.mutate({
      make,
      model,
      year: year ? parseInt(year, 10) : undefined,
      color,
      plateNumber,
      type: vehicleType,
      photoFront: pendingPhoto || photoFront || undefined,
      autoVerify: !!(pendingPhoto || photoFront),
      isElectric,
    });
  };

  const handleSaveEdits = () => {
    if (!make || !model || !plateNumber) {
      notify("Missing information", "Please fill in the make, model, and plate number.");
      return;
    }
    setActionLabel("Saving changes...");
    saveMutation.mutate({
      make,
      model,
      year: year ? parseInt(year, 10) : undefined,
      color,
      plateNumber,
      type: vehicleType,
      photoFront: photoFront || undefined,
      photoSide: photoSide || undefined,
      autoVerify: false,
      isElectric,
    });
  };

  // Clears the chosen photo but stays in the capture step ("use a different photo").
  const clearPendingPhoto = () => {
    setPendingPhoto(null);
    setShowManual(false);
    setMissingFields([]);
  };

  // Existing-vehicle owners scanning a brand new photo to re-verify.
  const startReScan = () => {
    setRescan(true);
    setPendingPhoto(null);
    setShowManual(false);
    setMissingFields([]);
  };

  const cancelReScan = () => {
    setRescan(false);
    setPendingPhoto(null);
  };

  const getVerificationBadge = () => {
    if (!verificationStatus) return null;

    const badgeConfig: Record<string, { color: string; icon: keyof typeof Feather.glyphMap; text: string }> = {
      ai_verified: { color: Colors.travonyGreen, icon: "check-circle", text: "AI Verified" },
      admin_verified: { color: Colors.travonyGreen, icon: "shield", text: "Admin Verified" },
      pending: { color: theme.warning, icon: "clock", text: "Pending Review" },
      rejected: { color: theme.error, icon: "x-circle", text: "Rejected" },
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

  const typeLabel = VEHICLE_TYPES.find((t) => t.value === (existingVehicle?.type || vehicleType))?.label;
  const carName = [existingVehicle?.year, existingVehicle?.color, existingVehicle?.make, existingVehicle?.model]
    .filter(Boolean)
    .join(" ");

  const renderManualForm = (missingOnly = false) => {
    const isMissing = (f: string) => missingFields.includes(f);
    return (
      <>
        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>Vehicle Type</ThemedText>
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
                <ThemedText style={[styles.typeChipText, { color: vehicleType === vt.value ? theme.textOnPrimary : theme.text }]}>
                  {vt.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FieldInput
          label="Make"
          value={make}
          onChangeText={setMake}
          placeholder="e.g., Toyota, Honda, Bajaj"
          theme={theme}
          highlight={isMissing("make")}
        />
        <FieldInput
          label="Model"
          value={model}
          onChangeText={setModel}
          placeholder="e.g., Camry, Civic, RE"
          theme={theme}
          highlight={isMissing("model")}
        />
        <FieldInput
          label="Year"
          value={year}
          onChangeText={setYear}
          placeholder="e.g., 2022"
          keyboardType="numeric"
          maxLength={4}
          theme={theme}
        />
        <FieldInput
          label="Color"
          value={color}
          onChangeText={setColor}
          placeholder="e.g., White, Black, Silver"
          theme={theme}
        />
        <FieldInput
          label="Plate Number"
          value={plateNumber}
          onChangeText={setPlateNumber}
          placeholder="e.g., DHAKA METRO-GA 12-3456"
          autoCapitalize="characters"
          theme={theme}
          highlight={isMissing("plateNumber")}
        />

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.evToggleRow}>
            <View style={styles.evToggleInfo}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>Electric Vehicle (EV)</ThemedText>
              <ThemedText style={[styles.hint, { color: theme.textMuted, marginTop: 2 }]}>
                Mark this vehicle as fully electric
              </ThemedText>
            </View>
            <Switch
              value={isElectric}
              onValueChange={setIsElectric}
              trackColor={{ false: theme.border, true: Colors.travonyGreen + "80" }}
              thumbColor={isElectric ? Colors.travonyGreen : theme.textMuted}
            />
          </View>
        </View>
      </>
    );
  };

  // ---- Loading ----
  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ============ INSTANT ACTIVATION CELEBRATION ============ */}
        {activation ? (
          <View style={styles.activationWrap}>
            <View style={[styles.activationIconCircle, { backgroundColor: Colors.travonyGreen + "20" }]}>
              <Feather name="zap" size={44} color={Colors.travonyGreen} />
            </View>
            <ThemedText style={styles.activationTitle}>{activation.carName} is now a business</ThemedText>
            {activation.seconds > 0 ? (
              <View style={[styles.activationTimeChip, { backgroundColor: Colors.travonyGreen }]}>
                <Feather name="clock" size={16} color={Colors.light.textOnPrimary} />
                <ThemedText style={styles.activationTimeText}>
                  Activated in {activation.seconds} {activation.seconds === 1 ? "second" : "seconds"}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText style={[styles.activationSub, { color: theme.textSecondary }]}>
              Verified by AI and approved to earn. No paperwork, no waiting for review.
            </ThemedText>
            <View style={[styles.activationEarnCard, { backgroundColor: theme.backgroundElevated }]}>
              <ThemedText style={[styles.activationEarnBig, { color: Colors.travonyGreen }]}>
                It keeps 90%
              </ThemedText>
              <ThemedText style={[styles.activationEarnSmall, { color: theme.textSecondary }]}>
                of everything it earns. Travony takes 10%. That's it.
              </ThemedText>
            </View>
            <Button onPress={() => setActivation(null)} style={styles.saveButton}>
              Start earning
            </Button>
          </View>
        ) : null}

        {/* ============ MANAGE EXISTING VEHICLE ============ */}
        {!activation && hasVehicle && !showManual && !rescan ? (
          <>
            {getVerificationBadge()}

            <View style={[styles.foundCard, { backgroundColor: theme.backgroundElevated }]}>
              {existingVehicle?.photoFront ? (
                <Image source={{ uri: existingVehicle.photoFront }} style={styles.foundImage} />
              ) : null}
              <View style={styles.foundBody}>
                <ThemedText style={styles.foundTitle}>{carName || "Your Vehicle"}</ThemedText>
                {typeLabel ? (
                  <ThemedText style={[styles.foundMeta, { color: theme.textSecondary }]}>{typeLabel}</ThemedText>
                ) : null}
                {existingVehicle?.plateNumber ? (
                  <View style={[styles.plateChip, { borderColor: theme.border }]}>
                    <ThemedText style={[styles.plateText, { color: theme.text }]}>
                      {existingVehicle.plateNumber}
                    </ThemedText>
                  </View>
                ) : null}
                {isElectric ? (
                  <View style={[styles.evBadgeInline, { backgroundColor: Colors.travonyGreen + "15" }]}>
                    <Feather name="zap" size={14} color={Colors.travonyGreen} />
                    <ThemedText style={[styles.hint, { color: Colors.travonyGreen, marginTop: 0, marginLeft: 6 }]}>
                      Electric vehicle
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            <Button onPress={() => setShowManual(true)} style={styles.saveButton}>
              Edit details
            </Button>
            <TouchableOpacity onPress={startReScan} style={styles.skipButton} disabled={isBusy}>
              <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
                Scan a new photo to re-verify
              </ThemedText>
            </TouchableOpacity>
          </>
        ) : null}

        {/* ============ ADD FLOW: STEP 1 — PHOTO ============ */}
        {!activation && (!hasVehicle || rescan) && !pendingPhoto && !showManual ? (
          <>
            <View style={[styles.infoCard, { backgroundColor: Colors.travonyGreen + "15" }]}>
              <ThemedText style={[styles.infoTitle, { color: Colors.travonyGreen }]}>Add your car in two steps</ThemedText>
              <ThemedText style={[styles.infoText, { color: Colors.travonyGreen }]}>
                Step 1: Take one clear photo of your car (show the number plate). Step 2: We find the make, model and
                details automatically. You just confirm.
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.captureBox, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
              onPress={takePhoto}
              disabled={isBusy}
            >
              <Feather name="camera" size={40} color={Colors.travonyGreen} />
              <ThemedText style={[styles.captureTitle, { color: theme.text }]}>Take a photo of your car</ThemedText>
              <ThemedText style={[styles.hint, { color: theme.textMuted, textAlign: "center" }]}>
                Stand in front, make sure the number plate is visible
              </ThemedText>
            </TouchableOpacity>

            <Button onPress={uploadPhoto} style={styles.saveButton} disabled={isBusy}>
              Upload from gallery
            </Button>

            {rescan ? (
              <TouchableOpacity onPress={cancelReScan} style={styles.skipButton} disabled={isBusy}>
                <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Cancel</ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowManual(true)} style={styles.skipButton} disabled={isBusy}>
                <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Enter details manually instead</ThemedText>
              </TouchableOpacity>
            )}
          </>
        ) : null}

        {/* ============ ADD FLOW: STEP 2 — FIND MY CAR ============ */}
        {!activation && (!hasVehicle || rescan) && pendingPhoto && !showManual ? (
          <>
            <View style={[styles.infoCard, { backgroundColor: Colors.travonyGreen + "15" }]}>
              <ThemedText style={[styles.infoText, { color: Colors.travonyGreen }]}>
                Step 2: Tap "Find my car" and we'll detect the make, model, color and plate from your photo.
              </ThemedText>
            </View>

            <Image source={{ uri: pendingPhoto }} style={styles.previewImage} />

            <Button onPress={handleFindMyCar} disabled={isBusy} style={styles.saveButton}>
              {isBusy ? "Finding your car..." : "Find my car"}
            </Button>
            <TouchableOpacity onPress={clearPendingPhoto} style={styles.skipButton} disabled={isBusy}>
              <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Use a different photo</ThemedText>
            </TouchableOpacity>
          </>
        ) : null}

        {/* ============ MANUAL FORM (fallback / edit / missing fields) ============ */}
        {!activation && showManual ? (
          <>
            {missingFields.length > 0 ? (
              <View style={[styles.infoCard, { backgroundColor: theme.warning + "20" }]}>
                <ThemedText style={[styles.infoTitle, { color: theme.warning }]}>Just a couple more details</ThemedText>
                <ThemedText style={[styles.infoText, { color: theme.warning }]}>
                  We found your car but couldn't read everything from the photo. Please complete the highlighted fields.
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.infoCard, { backgroundColor: Colors.travonyGreen + "15" }]}>
                <ThemedText style={[styles.infoText, { color: Colors.travonyGreen }]}>
                  {hasVehicle ? "Update your vehicle details below." : "Enter your vehicle details below."}
                </ThemedText>
              </View>
            )}

            {pendingPhoto ? <Image source={{ uri: pendingPhoto }} style={styles.previewImage} /> : null}

            {renderManualForm()}

            <Button
              onPress={hasVehicle ? handleSaveEdits : handleSaveManual}
              disabled={isBusy}
              style={styles.saveButton}
            >
              {isBusy ? "Saving..." : hasVehicle ? "Save changes" : "Save car"}
            </Button>
            <TouchableOpacity
              onPress={() => {
                setShowManual(false);
                setMissingFields([]);
              }}
              style={styles.skipButton}
              disabled={isBusy}
            >
              <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Cancel</ThemedText>
            </TouchableOpacity>
          </>
        ) : null}

        {isBusy ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.travonyGreen} />
            <ThemedText style={{ marginTop: Spacing.md }}>{actionLabel || "Working..."}</ThemedText>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  highlight,
  keyboardType,
  maxLength,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  theme: any;
  highlight?: boolean;
  keyboardType?: "numeric" | "default";
  maxLength?: number;
  autoCapitalize?: "characters" | "none" | "sentences" | "words";
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
      <ThemedText style={[styles.sectionTitle, { color: highlight ? theme.warning : theme.textSecondary }]}>
        {label}
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundRoot,
            color: theme.text,
            borderColor: highlight ? theme.warning : theme.border,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    ...Typography.h4Heavy,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  infoText: {
    ...Typography.small,
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
    ...Typography.smallBold,
  },
  foundCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  foundImage: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  foundBody: {
    padding: Spacing.lg,
  },
  foundTitle: {
    ...Typography.h3Heavy,
  },
  foundMeta: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  plateChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.md,
  },
  plateText: {
    ...Typography.h4Heavy,
    letterSpacing: 1,
  },
  captureBox: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 1.5,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  captureTitle: {
    ...Typography.h4,
    marginTop: Spacing.sm,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    resizeMode: "cover",
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.smallBold,
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
    ...Typography.smallMedium,
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
  activationWrap: {
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  activationIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  activationTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  activationTimeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  activationTimeText: {
    ...Typography.smallHeavy,
    color: Colors.light.textOnPrimary,
  },
  activationSub: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  activationEarnCard: {
    alignSelf: "stretch",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  activationEarnBig: {
    ...Typography.h1,
  },
  activationEarnSmall: {
    ...Typography.small,
    textAlign: "center",
    marginTop: 4,
  },
  saveButton: {
    marginTop: Spacing.sm,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  skipText: {
    ...Typography.small,
  },
  evToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  evToggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  evBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
  },
});
