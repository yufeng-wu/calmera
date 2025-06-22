import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";
import { useRouter } from "expo-router";

const NoRecordYet = () => {
  const router = useRouter();

  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="nutrition-outline"
        size={60}
        color={COLORS.textLight}
        style={styles.emptyStateIcon}
      />
      <Text style={styles.emptyStateTitle}>No food entries yet</Text>
      <Text style={styles.emptyStateText}>Log your first meal of the day!</Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={() => router.push("/create")}
      >
        <Ionicons name="add-circle" size={18} color={COLORS.white} />
        <Text style={styles.emptyStateButtonText}>Add Food Entry</Text>
      </TouchableOpacity>
    </View>
  );
};

export default NoRecordYet;
