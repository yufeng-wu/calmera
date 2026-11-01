import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";

const NoRecordYet = ({ title = "No food entries yet", text = "Log your first meal of the day!" }) => {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="nutrition-outline"
        size={60}
        color={COLORS.textLight}
        style={styles.emptyStateIcon}
      />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
};

export default NoRecordYet;
