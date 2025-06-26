import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/colors";
import { styles } from "@/assets/styles/home.styles";

export const SettingsButton = () => {
  const router = useRouter();

  const openSettings = () => {
    router.push("/settings");
  };

  return (
    <TouchableOpacity style={styles.logoutButton} onPress={openSettings}>
      <Ionicons name="settings-outline" size={22} color={COLORS.text} />
    </TouchableOpacity>
  );
};
