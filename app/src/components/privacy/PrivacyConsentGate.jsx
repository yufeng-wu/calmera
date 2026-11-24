import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppLoadingScreen from "@/components/brand/AppLoadingScreen";
import PrivacyConsentSheet from "@/components/privacy/PrivacyConsentSheet";
import { settingsStyles } from "@/components/settings/SettingsSection";
import { CONSENT_COPY } from "@/lib/privacy/privacyPolicy.mjs";
import { consentStatus, readConsent, saveConsent } from "@/lib/privacy/privacyConsent.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";

const PREVIEW_PHASES = { updated: "updated" };

// Nothing in calmera opens, and nothing reaches OpenAI, until the person has agreed to the
// current Privacy Policy. The agreement is saved on this iPhone, so the check is instant.
export default function PrivacyConsentGate({ children, disabled = false, calmeraPreview = false, calmeraPreviewState }) {
  const [phase, setPhase] = useState(() => disabled ? "accepted"
    : calmeraPreview ? PREVIEW_PHASES[calmeraPreviewState] || "needed" : "checking");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(calmeraPreview && calmeraPreviewState === "error" ? CONSENT_COPY.saveFailed : "");
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (disabled || calmeraPreview) return;
    let live = true;
    readConsent(AsyncStorage, LOCAL_OWNER).then((record) => { if (live) setPhase(consentStatus(record)); });
    return () => { live = false; };
  }, [disabled, calmeraPreview]);

  const agree = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setDeclined(false);
    try {
      if (calmeraPreview) await new Promise((resolve) => setTimeout(resolve, 900));
      else await saveConsent({ storage: AsyncStorage, owner: LOCAL_OWNER });
      setPhase("accepted");
    } catch {
      setError(CONSENT_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };
  // There's no account to leave, so declining explains what agreeing is for and waits.
  const decline = () => { setError(""); setDeclined(true); };

  if (phase === "accepted") return children ?? <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
    <Text style={[settingsStyles.lead, { textAlign: "center" }]}>You’re all set. Synthetic review; nothing was saved.</Text>
  </View>;
  if (phase === "checking") return <AppLoadingScreen />;
  return <PrivacyConsentSheet updated={phase === "updated"} saving={saving} error={error}
    notice={declined ? CONSENT_COPY.declined : ""} onAgree={agree} onDecline={decline} preview={calmeraPreview} />;
}
