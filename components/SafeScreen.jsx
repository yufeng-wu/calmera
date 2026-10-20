import { createContext } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_CANVAS_COLOR } from "@/constants/appearance.mjs";

export const SafeScreenTopContext = createContext(0);

const SafeScreen = ({ children, transparent = false, formOwnsTopInset = false }) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeScreenTopContext.Provider value={formOwnsTopInset ? insets.top : 0}>
    <View
      style={{
        paddingTop: formOwnsTopInset ? 0 : insets.top,
        paddingHorizontal: 0,
        flex: 1,
        backgroundColor: transparent ? "transparent" : BASE_CANVAS_COLOR,
      }}
    >
      {children}
    </View>
    </SafeScreenTopContext.Provider>
  );
};

export default SafeScreen;
