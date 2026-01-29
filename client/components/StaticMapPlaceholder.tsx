import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface StaticMapPlaceholderProps {
  onEnableMap?: () => void;
  showEnableButton?: boolean;
  message?: string;
}

export function StaticMapPlaceholder({ 
  onEnableMap, 
  showEnableButton = true,
  message = "Tap to show live map"
}: StaticMapPlaceholderProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#1a1a2e" : "#e8f4e8" }]}>
      <View style={styles.gridPattern}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.gridLine, 
              { backgroundColor: isDark ? "#2a2a4e" : "#d0e8d0" }
            ]} 
          />
        ))}
      </View>
      
      <View style={styles.centerContent}>
        <View style={[styles.iconCircle, { backgroundColor: Colors.travonyGreen + "20" }]}>
          <Ionicons name="location" size={48} color={Colors.travonyGreen} />
        </View>
        
        {showEnableButton && onEnableMap ? (
          <Pressable 
            style={[styles.enableButton, { backgroundColor: Colors.travonyGreen }]}
            onPress={onEnableMap}
          >
            <Ionicons name="map-outline" size={20} color="#fff" />
            <ThemedText style={styles.enableButtonText}>{message}</ThemedText>
          </Pressable>
        ) : (
          <ThemedText style={[styles.readyText, { color: theme.textSecondary }]}>
            Ready to navigate
          </ThemedText>
        )}
      </View>
      
      <View style={[styles.roadH, styles.road1, { backgroundColor: isDark ? "#3a3a5e" : "#c0d8c0" }]} />
      <View style={[styles.roadH, styles.road2, { backgroundColor: isDark ? "#3a3a5e" : "#c0d8c0" }]} />
      <View style={[styles.roadV, styles.road3, { backgroundColor: isDark ? "#3a3a5e" : "#c0d8c0" }]} />
      <View style={[styles.roadV, styles.road4, { backgroundColor: isDark ? "#3a3a5e" : "#c0d8c0" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  gridPattern: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridLine: {
    width: "10%",
    height: "10%",
    borderWidth: 0.5,
    borderColor: "transparent",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  enableButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  enableButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  readyText: {
    fontSize: 16,
  },
  roadH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 8,
  },
  roadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 8,
  },
  road1: {
    top: "30%",
  },
  road2: {
    top: "70%",
  },
  road3: {
    left: "25%",
  },
  road4: {
    left: "75%",
  },
});
