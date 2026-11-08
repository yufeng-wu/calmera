import { View } from "react-native";
import FoodwrapLoading from "@/components/FoodwrapLoading";

// The logo while calmera opens, before Today has anything to show.
export default function AppLoadingScreen() {
  return <View style={{ flex: 1, justifyContent: "center" }}>
    <FoodwrapLoading label="Loading…" showCaption={false} />
  </View>;
}
