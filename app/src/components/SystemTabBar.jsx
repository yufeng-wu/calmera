import { useContext } from "react";
import { BottomTabBar, BottomTabBarHeightCallbackContext } from "@react-navigation/bottom-tabs";
import { requireCalmeraNativeView } from "../../modules/calmera-native";
import { Platform, StyleSheet, View } from "react-native";

const SystemTabs = Platform.OS === "ios"
  ? requireCalmeraNativeView("SystemTabs")
  : null;
const routes = ["dashboard", "insights", "settings"];

export default function SystemTabBar(props) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  if (!SystemTabs) return <BottomTabBar {...props} />;
  const selectedRoute = props.state.routes[props.state.index];
  const selectedIndex = Math.max(0, routes.indexOf(selectedRoute.name));
  const onSelect = ({ nativeEvent }) => {
    const index = nativeEvent.index;
    if (!Number.isInteger(index) || index < 0 || index >= routes.length) return;
    const route = props.state.routes.find((candidate) => candidate.name === routes[index]);
    if (!route) return;
    const event = props.navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    // Dispatch every native selection: the last tap must win even before React rerenders.
    if (!event.defaultPrevented) {
      props.navigation.navigate(route.name, route.params);
    }
  };
  return <View pointerEvents="box-none" style={styles.overlay}
    onLayout={({ nativeEvent }) => onHeightChange?.(nativeEvent.layout.height)}>
    <SystemTabs selectedIndex={selectedIndex} onSelect={onSelect} previewPalette="tangerine"
      style={{ height: 64 + props.insets.bottom, width: "100%" }} />
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "transparent" },
});
