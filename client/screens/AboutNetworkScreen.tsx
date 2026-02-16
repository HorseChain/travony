import { View, StyleSheet, ScrollView } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

export default function AboutNetworkScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        <ThemedText style={styles.statement}>
          Travoney is building distributed mobility infrastructure where private vehicles operate as intelligent economic assets within a smart urban network.
        </ThemedText>
        
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <View style={styles.metrics}>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricValue, { color: Colors.travonyGreen }]}>1</ThemedText>
            <ThemedText style={[styles.metricLabel, { color: theme.textMuted }]}>Active Cities</ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricValue, { color: Colors.travonyGreen }]}>19</ThemedText>
            <ThemedText style={[styles.metricLabel, { color: theme.textMuted }]}>Network Members</ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricValue, { color: Colors.travonyGreen }]}>4.3</ThemedText>
            <ThemedText style={[styles.metricLabel, { color: theme.textMuted }]}>Version</ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing["2xl"],
    alignItems: "center",
  },
  statement: {
    fontSize: 17,
    fontWeight: "300",
    lineHeight: 28,
    textAlign: "center",
    letterSpacing: 0.3,
    maxWidth: 320,
  },
  divider: {
    width: 40,
    height: 1,
    marginVertical: Spacing["3xl"],
  },
  metrics: {
    flexDirection: "row",
    gap: Spacing["2xl"],
  },
  metricItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "600",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
