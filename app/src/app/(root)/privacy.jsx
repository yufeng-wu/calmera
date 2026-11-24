import { Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FormHeader, FormScreen, FormScrollView } from "@/components/GlassForm";
import PrivacyPolicyView from "@/components/PrivacyPolicyView";
import { settingsStyles } from "@/components/SettingsSection";
import usePageExit from "@/hooks/usePageExit";
import { PRIVACY_DOCS, PRIVACY_POLICY } from "@/lib/privacyPolicy.mjs";

// The Privacy Policy from Settings, and the Washington health data policy it links to.
export default function Privacy({ calmeraPreview = false, calmeraPreviewStage }) {
  const params = useLocalSearchParams();
  const requested = calmeraPreview ? calmeraPreviewStage : params.doc;
  const doc = PRIVACY_DOCS[Array.isArray(requested) ? requested[0] : requested] || PRIVACY_POLICY;
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/settings");
  const router = useRouter();
  const openDoc = (id) => calmeraPreview
    ? router.push({ pathname: "/ui-gallery", params: { page: `privacy-${id}` } })
    : router.push({ pathname: "/privacy", params: { doc: id } });
  return <FormScreen>
    <FormHeader title={doc === PRIVACY_POLICY ? "Privacy policy" : "Health data policy"} onBack={leave} />
    <FormScrollView contentContainerStyle={settingsStyles.content}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview</Text>}
      <PrivacyPolicyView doc={doc} onOpenDoc={openDoc} preview={calmeraPreview} />
    </FormScrollView>
  </FormScreen>;
}
