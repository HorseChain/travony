import { View, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface BankAccount {
  id: string;
  bankName: string;
  last4: string;
  accountHolderName: string;
  isDefault: boolean;
}

interface Driver {
  id: string;
  userId: string;
}

export default function DriverPaymentSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");

  const { data: driverData } = useQuery<Driver>({
    queryKey: ["/api/drivers/by-user", user?.id],
    enabled: !!user?.id && user?.role === "driver",
  });

  const driverId = driverData?.id;

  const { data: bankAccounts, isLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/drivers", driverId, "bank-accounts"],
    enabled: !!driverId,
  });

  const addAccountMutation = useMutation({
    mutationFn: async (data: { bankName: string; last4: string; accountHolderName: string }) => {
      return apiRequest(`/api/drivers/${driverId}/bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "bank-accounts"] });
      setIsAddingAccount(false);
      setBankName("");
      setAccountNumber("");
      setAccountHolderName("");
      if (Platform.OS === "web") {
        window.alert("Bank account added successfully!");
      } else {
        Alert.alert("Success", "Bank account added successfully!");
      }
    },
    onError: (error: any) => {
      const msg = error.message || "Failed to add bank account";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  const handleAddAccount = () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountHolderName.trim()) {
      const msg = "Please fill in all fields";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
      return;
    }
    const last4 = accountNumber.slice(-4);
    addAccountMutation.mutate({ bankName, last4, accountHolderName });
  };

  const renderBankAccount = (account: BankAccount) => (
    <View key={account.id} style={[styles.accountCard, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.accountHeader}>
        <View style={[styles.bankIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
          <Ionicons name="business-outline" size={24} color={Colors.travonyGreen} />
        </View>
        <View style={styles.accountInfo}>
          <ThemedText style={styles.bankName}>{account.bankName}</ThemedText>
          <ThemedText style={[styles.accountNumber, { color: theme.textSecondary }]}>
            **** {account.last4}
          </ThemedText>
        </View>
        {account.isDefault ? (
          <View style={[styles.defaultBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
            <ThemedText style={[styles.defaultText, { color: Colors.travonyGreen }]}>Default</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={[styles.holderName, { color: theme.textSecondary }]}>
        {account.accountHolderName}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Bank Accounts</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Add your bank account to receive payouts
          </ThemedText>
        </View>

        {(bankAccounts || []).map(renderBankAccount)}

        {(bankAccounts?.length || 0) === 0 && !isAddingAccount ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundElevated }]}>
            <Ionicons name="wallet-outline" size={48} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
              No bank accounts added
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Add a bank account to receive your earnings
            </ThemedText>
          </View>
        ) : null}

        {isAddingAccount ? (
          <View style={[styles.addAccountForm, { backgroundColor: theme.backgroundElevated }]}>
            <ThemedText style={styles.formTitle}>Add Bank Account</ThemedText>
            
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Bank Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., Emirates NBD"
                placeholderTextColor={theme.textMuted}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Account Number</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Enter account number"
                placeholderTextColor={theme.textMuted}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Account Holder Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Enter account holder name"
                placeholderTextColor={theme.textMuted}
                value={accountHolderName}
                onChangeText={setAccountHolderName}
              />
            </View>

            <View style={styles.formButtons}>
              <Pressable
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => {
                  setIsAddingAccount(false);
                  setBankName("");
                  setAccountNumber("");
                  setAccountHolderName("");
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.saveButton, { backgroundColor: Colors.travonyGreen }]}
                onPress={handleAddAccount}
                disabled={addAccountMutation.isPending}
              >
                {addAccountMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>Save</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={[styles.addButton, { borderColor: Colors.travonyGreen }]}
            onPress={() => setIsAddingAccount(true)}
          >
            <Ionicons name="add-outline" size={20} color={Colors.travonyGreen} />
            <ThemedText style={[styles.addButtonText, { color: Colors.travonyGreen }]}>
              Add Bank Account
            </ThemedText>
          </Pressable>
        )}

        <View style={[styles.infoCard, { backgroundColor: theme.backgroundElevated }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Payouts are processed every week. Minimum payout amount is AED 50.
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.body,
  },
  accountCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  accountInfo: {
    flex: 1,
  },
  bankName: {
    ...Typography.body,
    fontWeight: "600",
  },
  accountNumber: {
    ...Typography.small,
    marginTop: 2,
  },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  defaultText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  holderName: {
    ...Typography.small,
    marginLeft: 64,
  },
  emptyState: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: Spacing.lg,
  },
  addButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  addAccountForm: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  formTitle: {
    ...Typography.h4,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  input: {
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  formButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  saveButtonText: {
    ...Typography.body,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  infoCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },
});
