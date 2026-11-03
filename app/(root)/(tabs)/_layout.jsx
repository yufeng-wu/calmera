import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import SystemTabBar from "@/components/SystemTabBar";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Tabs tabBar={(props) => <SystemTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // A tab out of view skips re-renders until it's shown again, then catches up at once.
          freezeOnBlur: true,
          tabBarActiveTintColor: COLORS.primary,
          tabBarStyle: { height: Platform.OS === "ios" ? 64 + insets.bottom : 84, paddingBottom: 18, paddingTop: 8 },
          sceneStyle: { backgroundColor: COLORS.background },
          tabBarLabelStyle: {
            marginBottom: 4,
          },
          // Prevent flying icons by disabling animations
          tabBarHideOnKeyboard: false,
          tabBarAnimation: "none",
          tabBarIconStyle: {
            // Ensure icons stay in place
            transform: [{ translateX: 0 }, { translateY: 0 }],
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Today",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: "Insights",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
