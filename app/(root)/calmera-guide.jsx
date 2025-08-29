import React, { useRef, useState } from "react";
import {
  View,
  FlatList,
  Dimensions,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/colors";

const IMAGES = [
  require("@/assets/images/calmera-guide-1.png"),
  require("@/assets/images/calmera-guide-2.png"),
  require("@/assets/images/calmera-guide-3.png"),
  require("@/assets/images/calmera-guide-4.png"),
];

export default function CalmeraGuideScreen() {
  const router = useRouter();
  const { width, height } = Dimensions.get("window");
  const flatRef = useRef(null);
  const [page, setPage] = useState(0);

  const renderItem = ({ item }) => (
    <Image source={item} style={{ width, height, resizeMode: "cover" }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={28} color="#000" />
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={IMAGES}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newPage = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(newPage);
        }}
      />

      {/* Page Indicators */}
      <View style={styles.indicatorContainer}>
        {IMAGES.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              { backgroundColor: idx === page ? "#000" : "#bbb" },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: 10,
    left: 20,
    zIndex: 10,
    // Transparent touch area only (no visible bg)
    padding: 4,
  },
  indicatorContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
