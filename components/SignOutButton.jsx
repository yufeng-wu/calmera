import { useClerk } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { TouchableOpacity } from "react-native";
import { styles } from "@/assets/styles/home.styles";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";

export const SignOutButton = () => {
  // Use `useClerk()` to access the `signOut()` function
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => await signOut(),
      },
    ]);
  };

  return (
    <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
      <Ionicons name="log-out-outline" size={22} color={COLORS.text} />
    </TouchableOpacity>
  );
};
