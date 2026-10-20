import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_CANVAS_COLOR } from "@/constants/appearance.mjs";

const SafeScreen = ({ children, transparent = false }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 0,
        flex: 1,
        backgroundColor: transparent ? "transparent" : BASE_CANVAS_COLOR,
      }}
    >
      {children}
    </View>
  );
};

export default SafeScreen;
