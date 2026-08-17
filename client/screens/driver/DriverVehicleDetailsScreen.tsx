import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  TouchableOpacity,
  Image,
  ScrollView,
  Switch,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
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
import { FEATURES } from "@/constants/features";
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

/* ---- AI Scanning overlay ---- */
function ScanningOverlay({ photo }: { photo: string }) {
  const ring1 = useSharedValue(0.6);
  const ring2 = useSharedValue(0.6);
  const scanLine = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    ring1.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1000, easing: Easing.out(Easing.ease) }),
        withTiming(0.6, { duration: 1000, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    ring2.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 1000, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    scanLine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(scanLine);
    };
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1.value }],
    opacity: (1.3 - ring1.value) * 0.6,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2.value }],
    opacity: (1.5 - ring2.value) * 0.4,
  }));
  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLine.value * 220 - 110 }],
  }));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scanOverlay, wrapStyle]}>
      <Image source={{ uri: photo }} style={[StyleSheet.absoluteFill, styles.scanBg]} blurRadius={2} />
      <View style={styles.scanDim} />

      <View style={styles.scanCenter}>
        <View style={styles.scanRingWrap}>
          <Animated.View style={[styles.scanRing, styles.scanRing2, ring2Style]} />
          <Animated.View style={[styles.scanRing, styles.scanRing1, ring1Style]} />
          <View style={styles.scanIcon}>
            <Feather name="cpu" size={30} color={Colors.travonyGreen} />
          </View>
          <Animated.View style={[styles.scanLineBar, scanLineStyle]} />
        </View>
        <ThemedText style={styles.scanTitle}>AI scanning your vehicle</ThemedText>
        <ThemedText style={styles.scanSub}>
          Reading make · model · colour · plate number
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export default function DriverVehicleDetailsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
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

  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [rescan, setRescan] = useState(false);
  const [activation, setActivation] = useState<{ seconds: number; carName: string } | null>(null);

  const scanStartRef = useRef<number | null>(null);

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
    (vt) => vt.regions.includes(userRegion) || vt.regions.length === 0,
  );

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("/api/drivers/vehicle", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data: any) => {
      setIsScanning(false);
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/me"] });
      setPendingPhoto(null);
      setShowManual(false);
      setMissingFields([]);
      setRescan(false);

      if (data?.verificationStatus) setVerificationStatus(data.verificationStatus);

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
          ? "Your car was verified by AI. You are all set."
          : data?.verificationStatus === "pending"
            ? "Your car was saved. We will finish checking it shortly."
            : "Your car details were saved.";
      notify("Done", message);
    },
    onError: (error: any) => {
      setIsScanning(false);
      scanStartRef.current = null;

      if (error?.isAuthError || error?.statusCode === 401 || error?.statusCode === 403) {
        Alert.alert(
          "Session expired",
          "Your session has timed out. Please sign in again to continue.",
          [
            {
              text: "Sign in",
              onPress: () => {
                logout?.();
              },
            },
          ],
        );
        return;
      }

      const status = error?.statusCode;
      const details = error?.details;
      if (status === 422 && details) {
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
          error?.message || "We found your car but need a couple of details. Please fill them in below.",
        );
        return;
      }
      notify("Could not add your car", error?.message || "Please try again.");
    },
  });

  const isBusy = saveMutation.isPending;

  /* Auto-scans the moment a photo is selected — no extra button needed */
  const triggerScan = (base64Image: string) => {
    setPendingPhoto(base64Image);
    setShowManual(false);
    setMissingFields([]);
    setIsScanning(true);
    scanStartRef.current = Date.now();
    saveMutation.mutate({ photoFront: base64Image, autoVerify: true });
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notify(
          "Camera access needed",
          "Please allow camera access to photograph your car, or upload a photo from your gallery.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        triggerScan(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {
      notify("Camera unavailable", "Please upload a photo from your gallery instead.");
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
      if (!result.canceled && result.assets[0]?.base64) {
        triggerScan(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {
      notify("Could not open gallery", "Please try again.");
    }
  };

  const handleSaveManual = () => {
    if (!make || !model || !plateNumber) {
      notify("Missing information", "Please fill in the make, model, and plate number.");
      return;
    }
    setIsScanning(false);
    if (pendingPhoto || photoFront) scanStartRef.current = Date.now();
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
    setIsScanning(false);
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

  const startReScan = () => {
    setRescan(true);
    setPendingPhoto(null);
    setShowManual(false);
    setMissingFields([]);
    setIsScanning(false);
  };

  const cancelReScan = () => {
    setRescan(false);
    setPendingPhoto(null);
    setIsScanning(false);
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

  const renderManualForm = () => {
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
                <ThemedText
                  style={[
                    styles.typeChipText,
                    { color: vehicleType === vt.value ? theme.textOnPrimary : theme.text },
                  ]}
                >
                  {vt.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FieldInput label="Make" value={make} onChangeText={setMake} placeholder="e.g., Toyota, Honda" theme={theme} highlight={isMissing("make")} />
        <FieldInput label="Model" value={model} onChangeText={setModel} placeholder="e.g., Camry, Civic" theme={theme} highlight={isMissing("model")} />
        <FieldInput label="Year" value={year} onChangeText={setYear} placeholder="e.g., 2022" keyboardType="numeric" maxLength={4} theme={theme} />
        <FieldInput label="Colour" value={color} onChangeText={setColor} placeholder="e.g., White, Black, Silver" theme={theme} />
        <FieldInput label="Plate Number" value={plateNumber} onChangeText={setPlateNumber} placeholder="e.g., A 12345" autoCapitalize="characters" theme={theme} highlight={isMissing("plateNumber")} />

        {/* EV setting is flag-gated; existing isElectric data is preserved untouched. */}
        {FEATURES.ev ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.evToggleRow}>
            <View style={styles.evToggleInfo}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>Electric Vehicle (EV)</ThemedText>
              <ThemedText style={[styles.hint, { color: theme.textMuted, marginTop: 2 }]}>Mark this vehicle as fully electric</ThemedText>
            </View>
            <Switch
              value={isElectric}
              onValueChange={setIsElectric}
              trackColor={{ false: theme.border, true: Colors.travonyGreen + "80" }}
              thumbColor={isElectric ? Colors.travonyGreen : theme.textMuted}
            />
          </View>
        </View>
        ) : null}
      </>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Animated.View style={styles.loadingDot}>
          <Feather name="cpu" size={36} color={Colors.travonyGreen} />
          <ThemedText style={[styles.scanSub, { marginTop: Spacing.md }]}>Loading your vehicle info…</ThemedText>
        </Animated.View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarInset + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ====== ACTIVATION CELEBRATION ====== */}
        {activation ? (
          <View style={styles.activationWrap}>
            <View style={[styles.activationIconCircle, { backgroundColor: Colors.travonyGreen + "20" }]}>
              <Feather name="zap" size={44} color={Colors.travonyGreen} />
            </View>
            <ThemedText style={styles.activationTitle}>{activation.carName} is now a business</ThemedText>
            {activation.seconds > 0 ? (
              <View style={[styles.activationTimeChip, { backgroundColor: Colors.travonyGreen }]}>
                <Feather name="clock" size={16} color="#fff" />
                <ThemedText style={styles.activationTimeText}>
                  Activated in {activation.seconds} {activation.seconds === 1 ? "second" : "seconds"}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText style={[styles.activationSub, { color: theme.textSecondary }]}>
              Verified by AI and approved to earn. No paperwork, no waiting.
            </ThemedText>
            <View style={[styles.activationEarnCard, { backgroundColor: theme.backgroundElevated }]}>
              <ThemedText style={[styles.activationEarnBig, { color: Colors.travonyGreen }]}>It keeps 90%</ThemedText>
              <ThemedText style={[styles.activationEarnSmall, { color: theme.textSecondary }]}>
                of everything it earns. Travony takes 10%. That's it.
              </ThemedText>
            </View>
            <Button onPress={() => setActivation(null)} style={styles.saveButton}>Start earning</Button>
          </View>
        ) : null}

        {/* ====== EXISTING VEHICLE VIEW ====== */}
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
                    <ThemedText style={[styles.plateText, { color: theme.text }]}>{existingVehicle.plateNumber}</ThemedText>
                  </View>
                ) : null}
                {isElectric ? (
                  <View style={[styles.evBadgeInline, { backgroundColor: Colors.travonyGreen + "15" }]}>
                    <Feather name="zap" size={14} color={Colors.travonyGreen} />
                    <ThemedText style={[styles.hint, { color: Colors.travonyGreen, marginTop: 0, marginLeft: 6 }]}>Electric vehicle</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
            <Button onPress={() => setShowManual(true)} style={styles.saveButton}>Edit details</Button>
            <TouchableOpacity onPress={startReScan} style={styles.skipButton} disabled={isBusy}>
              <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Re-scan with a new photo</ThemedText>
            </TouchableOpacity>

            {/* ====== CAR PERSONA (talking car) ====== */}
            {existingVehicle?.id ? (
              <CarPersonaSection vehicleId={existingVehicle.id} theme={theme} />
            ) : null}
          </>
        ) : null}

        {/* ====== ADD FLOW: PHOTO CAPTURE ====== */}
        {!activation && (!hasVehicle || rescan) && !pendingPhoto && !showManual ? (
          <>
            <View style={[styles.infoCard, { backgroundColor: Colors.travonyGreen + "15" }]}>
              <View style={styles.aiHeader}>
                <Feather name="cpu" size={20} color={Colors.travonyGreen} />
                <ThemedText style={[styles.infoTitle, { color: Colors.travonyGreen }]}>One photo. Done.</ThemedText>
              </View>
              <ThemedText style={[styles.infoText, { color: Colors.travonyGreen }]}>
                Take one clear photo of your car showing the number plate. Our AI reads the make, model, colour and plate number instantly — no typing needed.
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.captureBox, { backgroundColor: theme.backgroundElevated, borderColor: Colors.travonyGreen + "60" }]}
              onPress={takePhoto}
              disabled={isBusy}
            >
              <View style={[styles.cameraIconWrap, { backgroundColor: Colors.travonyGreen + "15" }]}>
                <Feather name="camera" size={36} color={Colors.travonyGreen} />
              </View>
              <ThemedText style={[styles.captureTitle, { color: theme.text }]}>Take a photo</ThemedText>
              <ThemedText style={[styles.hint, { color: theme.textMuted, textAlign: "center" }]}>
                Stand in front of the car — make the plate clearly visible
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
                <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Enter details manually</ThemedText>
              </TouchableOpacity>
            )}
          </>
        ) : null}

        {/* ====== MANUAL FORM (fallback / edit / missing fields) ====== */}
        {!activation && showManual ? (
          <>
            {missingFields.length > 0 ? (
              <View style={[styles.infoCard, { backgroundColor: theme.warning + "20" }]}>
                <ThemedText style={[styles.infoTitle, { color: theme.warning }]}>Just a couple more details</ThemedText>
                <ThemedText style={[styles.infoText, { color: theme.warning }]}>
                  The AI found your car but could not read every detail from the photo. Fill in the highlighted fields and save.
                </ThemedText>
              </View>
            ) : null}

            {renderManualForm()}

            <Button
              onPress={hasVehicle ? handleSaveEdits : handleSaveManual}
              disabled={isBusy}
              style={styles.saveButton}
            >
              {isBusy ? "Saving…" : hasVehicle ? "Save changes" : "Save car"}
            </Button>
            <TouchableOpacity
              onPress={() => { setShowManual(false); setMissingFields([]); }}
              style={styles.skipButton}
              disabled={isBusy}
            >
              <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Cancel</ThemedText>
            </TouchableOpacity>
          </>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      {/* ====== AI SCANNING OVERLAY (shown while AI processes) ====== */}
      {isScanning && pendingPhoto ? (
        <ScanningOverlay photo={pendingPhoto} />
      ) : null}
    </ThemedView>
  );
}

/* ---- Car persona editor — the car's public "talking AI" identity ----
 * The blurb is AI-drafted from the car's REAL stats (trips, rating, tenure)
 * and re-checked server-side: made-up numbers are rejected. Preview never
 * saves; only "Save persona" does. */
const PERSONA_TONES = [
  { value: "warm", label: "Warm" },
  { value: "playful", label: "Playful" },
  { value: "professional", label: "Professional" },
] as const;

function CarPersonaSection({ vehicleId, theme }: { vehicleId: string; theme: any }) {
  const queryClient = useQueryClient();
  const [personaName, setPersonaName] = useState("");
  const [tone, setTone] = useState("warm");
  const [blurb, setBlurb] = useState("");
  const seeded = useRef(false);

  const { data: profile } = useQuery<{ personaName: string; blurb: string; tone: string }>({
    queryKey: [`/api/cars/${vehicleId}/profile`],
  });

  useEffect(() => {
    if (profile && !seeded.current) {
      seeded.current = true;
      setPersonaName(profile.personaName || "");
      setTone(profile.tone || "warm");
      setBlurb(profile.blurb || "");
    }
  }, [profile]);

  const previewMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/cars/${vehicleId}/persona/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      }),
    onSuccess: (data: any) => {
      if (data?.blurb) setBlurb(data.blurb);
    },
    onError: (error: any) => {
      notify("Could not draft an intro", error?.message || "Please try again.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/cars/${vehicleId}/persona`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaName, personaBlurb: blurb, personaTone: tone }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cars/${vehicleId}/profile`] });
      notify("Saved", "Your car's public persona is live.");
    },
    onError: (error: any) => {
      notify("Could not save", error?.message || "Please try again.");
    },
  });

  const busy = previewMutation.isPending || saveMutation.isPending;

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundElevated, marginTop: Spacing.xl }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="message-circle" size={16} color={Colors.travonyGreen} />
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>Car persona</ThemedText>
      </View>
      <ThemedText style={[styles.hint, { color: theme.textMuted, marginTop: 4 }]}>
        Riders can talk to your car and book it directly. Give it a name and an intro — the AI
        drafts one from your car's real stats, and you decide what goes public.
      </ThemedText>

      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>Name</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
        value={personaName}
        onChangeText={setPersonaName}
        placeholder="e.g., Silver Arrow"
        placeholderTextColor={theme.textMuted}
        maxLength={40}
        editable={!busy}
      />

      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.md }]}>Tone</ThemedText>
      <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs }}>
        {PERSONA_TONES.map((t) => (
          <TouchableOpacity
            key={t.value}
            onPress={() => setTone(t.value)}
            disabled={busy}
            style={{
              paddingHorizontal: Spacing.md,
              paddingVertical: 8,
              borderRadius: BorderRadius.md,
              borderWidth: 1,
              borderColor: tone === t.value ? Colors.travonyGreen : theme.border,
              backgroundColor: tone === t.value ? Colors.travonyGreen + "18" : "transparent",
            }}
          >
            <ThemedText style={{ fontSize: 13, color: tone === t.value ? Colors.travonyGreen : theme.textSecondary }}>
              {t.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.md }]}>Intro</ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.backgroundDefault,
            minHeight: 80,
            textAlignVertical: "top",
          },
        ]}
        value={blurb}
        onChangeText={setBlurb}
        placeholder="Tap Draft with AI, or write your own"
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={280}
        editable={!busy}
      />

      <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
        <TouchableOpacity
          onPress={() => previewMutation.mutate()}
          disabled={busy}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 12,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            borderColor: Colors.travonyGreen,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Feather name="cpu" size={15} color={Colors.travonyGreen} />
          <ThemedText style={{ fontSize: 14, fontWeight: "600", color: Colors.travonyGreen }}>
            {previewMutation.isPending ? "Drafting…" : blurb ? "Redraft with AI" : "Draft with AI"}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => saveMutation.mutate()}
          disabled={busy || !blurb.trim()}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 12,
            borderRadius: BorderRadius.md,
            backgroundColor: Colors.travonyGreen,
            opacity: busy || !blurb.trim() ? 0.6 : 1,
          }}
        >
          <ThemedText style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
            {saveMutation.isPending ? "Saving…" : "Save persona"}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
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
          { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: highlight ? theme.warning : theme.border },
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
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: Spacing.lg },
  loadingDot: { alignItems: "center" },

  /* Info card */
  infoCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg },
  aiHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  infoTitle: { ...Typography.h4Heavy, textAlign: "center" },
  infoText: { ...Typography.small, textAlign: "center" },

  /* Verification badge */
  verificationBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, gap: Spacing.sm },
  badgeText: { ...Typography.smallBold },

  /* Existing vehicle card */
  foundCard: { borderRadius: BorderRadius.xl, overflow: "hidden", marginBottom: Spacing.lg },
  foundImage: { width: "100%", height: 180, resizeMode: "cover" },
  foundBody: { padding: Spacing.lg },
  foundTitle: { ...Typography.h3Heavy },
  foundMeta: { ...Typography.small, marginTop: Spacing.xs },
  plateChip: { alignSelf: "flex-start", borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: Spacing.md },
  plateText: { ...Typography.h4Heavy, letterSpacing: 1 },
  evBadgeInline: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignSelf: "flex-start" },

  /* Capture box */
  captureBox: { borderRadius: BorderRadius.xl, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.xl * 2, paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.lg },
  cameraIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  captureTitle: { ...Typography.h4, marginTop: Spacing.xs },

  /* Form */
  section: { padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.smallBold, marginBottom: Spacing.sm, textTransform: "uppercase" },
  typeScroll: { marginHorizontal: -Spacing.sm },
  typeChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginHorizontal: Spacing.xs, borderWidth: 1 },
  typeChipText: { ...Typography.smallMedium },
  input: { ...Typography.body, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  hint: { ...Typography.caption, marginTop: Spacing.sm },
  evToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  evToggleInfo: { flex: 1, marginRight: Spacing.md },

  /* Buttons */
  saveButton: { marginTop: Spacing.sm },
  skipButton: { alignItems: "center", paddingVertical: Spacing.lg },
  skipText: { ...Typography.small },

  /* Activation */
  activationWrap: { alignItems: "center", paddingTop: Spacing.xl },
  activationIconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  activationTitle: { ...Typography.h2, textAlign: "center", marginBottom: Spacing.md },
  activationTimeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, marginBottom: Spacing.md },
  activationTimeText: { ...Typography.smallHeavy, color: "#fff" },
  activationSub: { ...Typography.body, textAlign: "center", marginBottom: Spacing.lg, paddingHorizontal: Spacing.md },
  activationEarnCard: { alignSelf: "stretch", borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.lg },
  activationEarnBig: { ...Typography.h1 },
  activationEarnSmall: { ...Typography.small, textAlign: "center", marginTop: 4 },

  /* AI scanning overlay */
  scanOverlay: { zIndex: 100, alignItems: "center", justifyContent: "center" },
  scanBg: { resizeMode: "cover" },
  scanDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)" },
  scanCenter: { alignItems: "center", paddingHorizontal: Spacing.xl },
  scanRingWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl, overflow: "visible" },
  scanRing: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: Colors.travonyGreen },
  scanRing1: { borderColor: Colors.travonyGreen },
  scanRing2: { borderColor: Colors.travonyGreen + "80" },
  scanIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.travonyGreen + "20", alignItems: "center", justifyContent: "center" },
  scanLineBar: { position: "absolute", left: -10, right: -10, height: 2, backgroundColor: Colors.travonyGreen + "cc", borderRadius: 1 },
  scanTitle: { ...Typography.h3Heavy, color: "#fff", textAlign: "center", marginBottom: Spacing.sm },
  scanSub: { ...Typography.small, color: "rgba(255,255,255,0.65)", textAlign: "center" },
});
