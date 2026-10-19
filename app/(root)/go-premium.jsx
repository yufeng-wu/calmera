import { Redirect } from "expo-router";
import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { COLORS, RAINBOW_COLORS } from "@/constants/colors";
import { styles } from "@/assets/styles/home.styles";
import SubscriptionComparison from "@/components/SubscriptionComparison";
import { useStripe } from "@stripe/stripe-react-native";
import { useAuth } from "@clerk/clerk-expo";
import { PAYMENTS_API_URL } from "@/constants/api";
import { useState, useEffect } from "react";
import { usePremium } from "@/context/PremiumContext";
import { ActivityIndicator } from "react-native";

export function LegacyGoPremium() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { getToken } = useAuth();
  const { isPremium, refreshPremium } = usePremium();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isPremium) {
      // congratulating user on already being premium
      Alert.alert("Congratulations 🎉", "You are now a Premium member!");
      router.back();
    }
  }, [isPremium]);

  // Generic handler for both monthly & yearly plans
  const payPremium = async (plan) => {
    try {
      setLoading(true);
      const token = await getToken();
      // Fetch client secret for the desired plan from backend
      const response = await fetch(PAYMENTS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }), // "monthly" | "yearly"
      });

      const { clientSecret, error } = await response.json();
      if (!response.ok || !clientSecret) {
        throw new Error(error || "Failed to create payment intent");
      }

      // Initialize & show Stripe Payment Sheet (Apple Pay auto-appears when available)
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Calmera",
        merchantCountryCode: "US",
        returnURL: Linking.createURL("stripe-redirect"),
        applePay: {
          merchantCountryCode: "US",
        },
      });
      if (initError) throw initError;

      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) throw sheetError;

      // Show processing indicator while verifying subscription status
      setVerifying(true);

      const poll = setInterval(async () => {
        await refreshPremium();
        if (isPremium) {
          clearInterval(poll);
          setVerifying(false);
          router.back(); // return to main screen
          Alert.alert("Congratulations", "You are now a Premium member! 🎉");
        }
      }, 3000);
      // Failsafe stop after 30s
      setTimeout(() => {
        clearInterval(poll);
        setVerifying(false);
      }, 30000);
    } catch (err) {
      // If the user cancels the sheet, Stripe returns an error with code "Canceled".
      if (err?.code === "Canceled") {
        // Silently ignore cancellations – no need to alarm the user.
        return;
      }
      console.error(err);
      Alert.alert("Payment failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { alignItems: "center" }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Verifying overlay */}
      {verifying && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 20,
          }}
        >
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={{ color: COLORS.white, marginTop: 16 }}>
            Processing your purchase…
          </Text>
        </View>
      )}
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: "absolute", top: 10, left: 10, padding: 8 }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      {/* Title */}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          marginBottom: 30,
          marginTop: 50,
          width: "90%",
          textAlign: "center",
        }}
      >
        Compare Plans
      </Text>

      {/* Comparison Table */}
      <SubscriptionComparison />

      {/* Subscription Options */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          marginTop: 10,
          marginBottom: 20,
          width: "90%",
          textAlign: "left",
        }}
      >
        Select your subscription:
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          width: "90%",
          alignSelf: "center",
          marginBottom: 24,
        }}
      >
        {(() => {
          const MONTHLY_PRICE = 14.99;
          const YEARLY_TOTAL = 59.88;
          const yearlyMonthly = (YEARLY_TOTAL / 12).toFixed(2);
          const savePct = Math.round((1 - yearlyMonthly / MONTHLY_PRICE) * 100);
          return [
            {
              plan: "monthly",
              header: "1 month",
              priceLine: `$${MONTHLY_PRICE}/mo`,
              subLine: "Billed monthly",
            },
            {
              plan: "yearly",
              header: "12 months",
              priceLine: `$${yearlyMonthly}/mo`,
              subLine: `$${YEARLY_TOTAL} billed annually`,
              badge: `Save ${savePct}%`,
            },
          ];
        })().map((opt) => {
          const isSelected = selectedPlan === opt.plan;
          return (
            <TouchableOpacity
              key={opt.plan}
              onPress={() => setSelectedPlan(opt.plan)}
              style={{
                flex: 1,
                marginHorizontal: 4,
                paddingVertical: 20,
                borderRadius: 30,
                borderWidth: 2,
                borderColor: isSelected ? COLORS.primary : COLORS.text,
                backgroundColor: isSelected
                  ? COLORS.primary + "22"
                  : "transparent",
                alignItems: "center",
              }}
              disabled={loading}
            >
              {/* Optional badge */}
              {opt.badge && (
                <View
                  style={{
                    position: "absolute",
                    top: -12,
                    backgroundColor: isSelected
                      ? COLORS.primary
                      : COLORS.background,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isSelected ? COLORS.primary : COLORS.text,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? COLORS.white : COLORS.text,
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    {opt.badge}
                  </Text>
                </View>
              )}
              <Text
                style={{
                  fontWeight: "600",
                  color: COLORS.text,
                }}
              >
                {opt.header}
              </Text>
              <Text style={{ fontSize: 16, marginTop: 6 }}>
                {opt.priceLine}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.text, marginTop: 6 }}>
                {opt.subLine}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Purchase Button with rainbow gradient */}
      <LinearGradient
        colors={RAINBOW_COLORS}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={{
          borderRadius: 24,
          marginBottom: 32,
          width: "90%",
          alignSelf: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => payPremium(selectedPlan)}
          style={{ paddingVertical: 14, alignItems: "center" }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={{ color: COLORS.white, fontWeight: "600" }}>
            {loading
              ? "Processing..."
              : selectedPlan === "monthly"
              ? "Subscribe for $14.99 / month"
              : "Subscribe for $59.88 / year"}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </ScrollView>
  );
}

export default function GoPremium() {
  return <Redirect href="/chatgpt" />;
}
