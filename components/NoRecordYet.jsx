import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";

const NoRecordYet = () => {
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
    </View>
  );
};

export default NoRecordYet;
