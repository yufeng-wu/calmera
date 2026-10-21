import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";

const rows = [
  { label: "Live Mode", sub: "Only at calmera", free: false },
  { label: "Photo Log", free: false },
  { label: "Voice Log", free: false },
  { label: "Manual Logging", free: true },
];

export default function SubscriptionComparison() {
  return (
    <View
      style={{
        width: "90%",
        maxWidth: 540,
        alignSelf: "center",
        marginBottom: 16,
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 16,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        <View style={{ flex: 1 }} />
        <Text style={{ flex: 1, textAlign: "center", fontWeight: "600" }}>
          Free
        </Text>
        <Text style={{ flex: 1, textAlign: "center", fontWeight: "600" }}>
          Premium
        </Text>
      </View>

      {rows.map((row) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 44,
            paddingVertical: 6,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text>{row.label}</Text>
            {row.sub && (
              <Text style={{ fontSize: 12, color: COLORS.textLight }}>
                {row.sub}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Ionicons
              name={row.free ? "checkmark" : "close"}
              size={24}
              color={row.free ? COLORS.primary : COLORS.text}
            />
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Ionicons name="checkmark" size={24} color={COLORS.primary} />
          </View>
        </View>
      ))}
    </View>
  );
}
