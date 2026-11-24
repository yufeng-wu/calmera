import { View } from "react-native";
import CalmeraLoading from "@/components/brand/CalmeraLoading";

// The logo while calmera opens, before Today has anything to show.
export default function AppLoadingScreen() {
  return <View style={{ flex: 1, justifyContent: "center" }}>
    <CalmeraLoading label="Loading…" showCaption={false} />
  </View>;
}
