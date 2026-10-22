import { Redirect } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { usePremium } from "@/context/PremiumContext";
import SubscriptionComparison from "@/components/SubscriptionComparison";
import { styles } from "@/assets/styles/home.styles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/colors";

export function LegacyPremiumPlan() {
  const { plan, premiumExpiresAt } = usePremium();
  const planLabel = plan === "yearly" ? "Year Pass" : "Month Pass";
  const router = useRouter();
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(premiumExpiresAt).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );
  return (
    <ScrollView contentContainerStyle={[styles.container]}>
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: "absolute", top: 10, left: 10, padding: 8 }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <View style={{ paddingTop: 18, paddingBottom: 6, paddingHorizontal: 20 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 26,
            marginTop: 30,
            width: "100%",
            textAlign: "center",
          }}
        >
          My Premium Plan
        </Text>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: COLORS.primary + "22",
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontWeight: "600" }}>Current Plan: {planLabel}</Text>
        </View>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: COLORS.primary + "22",
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontWeight: "600" }}>
            Expires on {new Date(premiumExpiresAt).toLocaleDateString()} •{" "}
            {daysLeft} days left
          </Text>
        </View>
      </View>
      <SubscriptionComparison />
    </ScrollView>
  );
}

export default function PremiumPlan() {
  return <Redirect href="/chatgpt" />;
}
