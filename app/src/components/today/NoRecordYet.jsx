import { Text, View } from "react-native";
import { styles } from "./home.styles";
import CitrusBuddy from "../brand/CitrusBuddy";

const NoRecordYet = ({ title, text, asleep = false }) => {
  return (
    <View style={styles.emptyState}>
      <CitrusBuddy asleep={asleep} style={styles.emptyStateIcon} />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
};

export default NoRecordYet;
