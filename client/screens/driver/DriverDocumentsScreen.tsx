import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { ScrollView } from "react-native";

interface DocumentItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: "verified" | "pending" | "required";
  expiryDate?: string;
}

interface DriverData {
  id: string;
  status: string;
  licenseNumber: string;
}

export default function DriverDocumentsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const { data: driverData } = useQuery<DriverData>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  const documents: DocumentItem[] = [
    {
      id: "license",
      title: "Driver's License",
      description: driverData?.licenseNumber ? `License: ${driverData.licenseNumber}` : "Upload your valid driver's license",
      icon: "card-outline",
      status: driverData?.licenseNumber ? "verified" : "required",
    },
    {
      id: "registration",
      title: "Vehicle Registration",
      description: "Vehicle registration card (Mulkiya)",
      icon: "document-text-outline",
      status: "verified",
    },
    {
      id: "insurance",
      title: "Insurance",
      description: "Valid vehicle insurance document",
      icon: "shield-checkmark-outline",
      status: "verified",
    },
    {
      id: "emirates_id",
      title: "Emirates ID",
      description: "Valid Emirates ID card",
      icon: "person-outline",
      status: "verified",
    },
    {
      id: "profile_photo",
      title: "Profile Photo",
      description: "Clear photo of your face",
      icon: "camera-outline",
      status: "verified",
    },
  ];

  const getStatusColor = (status: DocumentItem["status"]) => {
    switch (status) {
      case "verified":
        return Colors.travonyGreen;
      case "pending":
        return "#FFC107";
      case "required":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  const getStatusText = (status: DocumentItem["status"]) => {
    switch (status) {
      case "verified":
        return "Verified";
      case "pending":
        return "Pending Review";
      case "required":
        return "Required";
      default:
        return "";
    }
  };

  const getStatusIcon = (status: DocumentItem["status"]): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "verified":
        return "checkmark-circle";
      case "pending":
        return "time";
      case "required":
        return "alert-circle";
      default:
        return "help-circle";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusCard, { backgroundColor: Colors.travonyGreen + "15" }]}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.travonyGreen} />
          <View style={styles.statusContent}>
            <ThemedText style={[styles.statusTitle, { color: Colors.travonyGreen }]}>
              Documents Verified
            </ThemedText>
            <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
              Your account is active and ready for rides
            </ThemedText>
          </View>
        </View>

        <View style={[styles.documentsSection, { backgroundColor: theme.backgroundElevated }]}>
          {documents.map((doc, index) => (
            <Pressable
              key={doc.id}
              style={[
                styles.documentItem,
                index < documents.length - 1 && styles.documentItemBorder,
                { borderBottomColor: theme.border },
              ]}
            >
              <View style={[styles.docIcon, { backgroundColor: theme.backgroundRoot }]}>
                <Ionicons name={doc.icon} size={20} color={Colors.travonyGreen} />
              </View>
              <View style={styles.docContent}>
                <ThemedText style={styles.docTitle}>{doc.title}</ThemedText>
                <ThemedText style={[styles.docDescription, { color: theme.textSecondary }]}>
                  {doc.description}
                </ThemedText>
              </View>
              <View style={styles.docStatus}>
                <Ionicons
                  name={getStatusIcon(doc.status)}
                  size={20}
                  color={getStatusColor(doc.status)}
                />
                <ThemedText style={[styles.statusLabel, { color: getStatusColor(doc.status) }]}>
                  {getStatusText(doc.status)}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.backgroundElevated }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            To update documents, please contact support through the Help & Support section.
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  statusSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  documentsSection: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  documentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  documentItemBorder: {
    borderBottomWidth: 1,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  docContent: {
    flex: 1,
  },
  docTitle: {
    ...Typography.body,
    fontWeight: "500",
  },
  docDescription: {
    ...Typography.small,
    marginTop: 2,
  },
  docStatus: {
    alignItems: "flex-end",
    gap: 2,
  },
  statusLabel: {
    ...Typography.caption,
    fontWeight: "500",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },
});
