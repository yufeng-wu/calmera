import { KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormHeader, formStyles } from "@/components/GlassForm";
import ChatPanel from "@/components/insights/ChatPanel";
import { useInsights } from "@/hooks/useInsights";

// "Ask about this" from a dashboard row opens here with the question filled in.
export default function InsightsChat() {
  const router = useRouter();
  const { q } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { ask, sample } = useInsights({ report: false });
  return <KeyboardAvoidingView style={formStyles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <FormHeader title="Ask" onBack={() => router.back()} />
    <ChatPanel ask={ask} initialQuestion={typeof q === "string" ? q : null} bottomInset={Math.max(insets.bottom, 12)}
      contextLabel={sample ? "Using sample data" : "Using your last 30 days"} />
  </KeyboardAvoidingView>;
}
