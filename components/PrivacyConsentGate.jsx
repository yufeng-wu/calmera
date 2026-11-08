import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { AccountLoadingScreen } from "@/components/AccountProfileGate";
import { AuthScreen } from "@/components/AuthForm";
import PrivacyConsentSheet from "@/components/PrivacyConsentSheet";
import { CONSENT_COPY } from "@/lib/privacyPolicy.mjs";
import { cacheConsent, consentStatus, readLocalConsent, readRemoteConsent, saveConsent, syncConsent } from "@/lib/privacyConsent.mjs";

const PREVIEW_PHASES = { updated: "updated" };

// Nothing in calmera opens, and nothing reaches OpenAI, until the person has agreed to the
// current Privacy Policy. Declining signs out. The phone's copy makes the check instant.
export default function PrivacyConsentGate({ children, disabled = false, calmeraPreview = false, calmeraPreviewState }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;
  const [phase, setPhase] = useState(() => disabled ? "accepted"
    : calmeraPreview ? PREVIEW_PHASES[calmeraPreviewState] || "needed" : "checking");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(calmeraPreview && calmeraPreviewState === "error" ? CONSENT_COPY.saveFailed : "");

  useEffect(() => {
    if (disabled || calmeraPreview || !userId) return;
    let live = true;
    readLocalConsent(AsyncStorage, userId).then((local) => {
      if (!live) return;
      const current = userRef.current;
      const result = consentStatus({ local, remote: readRemoteConsent(current?.unsafeMetadata) });
      setPhase(result.status);
      if (result.needsCache) cacheConsent(AsyncStorage, userId, result.record);
      if (result.needsSync && current) syncConsent(current, result.record);
    });
    return () => { live = false; };
  }, [disabled, calmeraPreview, userId]);

  const agree = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (calmeraPreview) await new Promise((resolve) => setTimeout(resolve, 900));
      else await saveConsent({ storage: AsyncStorage, user: userRef.current, userId });
      setPhase("accepted");
    } catch {
      setError(CONSENT_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };
  const decline = () => {
    if (calmeraPreview) { setError("Preview only. Nobody was signed out."); return; }
    signOut().catch(() => setError("We couldn’t sign you out. Please try again."));
  };

  if (phase === "accepted") return children ?? <AuthScreen title="You’re all set" subtitle="Synthetic review. Nothing was saved." />;
  if (phase === "checking") return <AccountLoadingScreen />;
  return <PrivacyConsentSheet updated={phase === "updated"} saving={saving} error={error}
    onAgree={agree} onDecline={decline} preview={calmeraPreview} />;
}
