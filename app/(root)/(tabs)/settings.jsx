import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { styles as createStyles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useClerk();

  const handleLogout = async () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => await signOut(),
      },
    ]);
  };

  const handleUpdateGoals = () => {
    router.push("/update-goals");
  };

  return (
    <View style={createStyles.container}>
      <View style={styles.profileHeader}>
        <Text style={styles.profileTitle}>Settings</Text>
      </View>

      <View style={styles.contentWrapper}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={handleUpdateGoals}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.text} />
          <Text style={styles.optionText}>
            Update Daily Macro Goals / Get Personalized Recommendations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={20}
            color={COLORS.destructive}
          />
          <Text style={[styles.optionText, { color: COLORS.destructive }]}>
            Log Out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: "center",
    marginTop: 16,
  },
  profileTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  contentWrapper: {
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
});
