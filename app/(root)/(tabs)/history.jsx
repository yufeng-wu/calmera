import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>History will be available soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  text: {
    fontSize: 16,
    color: COLORS.text,
  },
});
