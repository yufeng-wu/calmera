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

  const handleEditGoals = () => {
    router.push("/edit-goals");
  };

  return (
    <View style={createStyles.container}>
      <View style={createStyles.header}>
        <TouchableOpacity
          style={createStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={createStyles.headerTitle}>Settings</Text>
        {/* empty placeholder to balance layout */}
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.contentWrapper}>
        <TouchableOpacity style={styles.optionButton} onPress={handleEditGoals}>
          <Ionicons name="create-outline" size={20} color={COLORS.text} />
          <Text style={styles.optionText}>Change Macro Goals</Text>
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
  contentWrapper: {
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
  },
});
