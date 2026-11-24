import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CalmeraWordmark from "@/components/brand/CalmeraWordmark";
import { FormHeader, FormScreen, FormScrollView, GlassButton } from "@/components/GlassForm";
import PrivacyPolicyView from "@/components/privacy/PrivacyPolicyView";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { settingsStyles } from "@/components/settings/SettingsSection";
import { SETTINGS } from "@/constants/settingsTheme";
import { CONSENT_COPY as COPY, PRIVACY_DOCS } from "@/lib/privacy/privacyPolicy.mjs";

// The agreement names the policy once; that phrase opens it.
const POLICY_LINK = "Privacy Policy";
const [before, after] = COPY.agreement.split(POLICY_LINK);
const EDGE = 28;

// Shown once to everyone before calmera opens, and again after a material policy change:
// what we keep, what goes to the chosen AI provider, the full policy, and one explicit choice. Plain type
// on the page: no cards, no icons.
export default function PrivacyConsentSheet({ updated = false, saving = false, error = "", notice = "", onAgree, onDecline, preview = false }) {
  const { bottom } = useSafeAreaInsets();
  const [policy, setPolicy] = useState(null);
  const { fontScale, height } = useWindowDimensions();
  const inScroll = fontScale >= 1.5 || height < 600;
  const footer = (
    <View style={[styles.footer, inScroll ? styles.inlineFooter : { paddingBottom: Math.max(bottom, 16) }]}>
      <Pressable accessibilityRole="link" accessibilityLabel={COPY.agreement} accessibilityHint="Opens the Privacy Policy"
        testID="consent-privacy-policy" onPress={() => setPolicy("privacy")}>
        <Text style={styles.agreement}>{before}<Text style={styles.policyLink}>{POLICY_LINK}</Text>{after}</Text>
      </Pressable>
      <GlassButton title={COPY.agree} role="accent" onPress={onAgree} loading={saving} disabled={saving} style={styles.agree} />
      {!!error && <Text accessibilityLiveRegion="assertive" style={[settingsStyles.problem, styles.message]}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.agreement, styles.message, styles.notice]}>{notice}</Text>}
      <Pressable onPress={onDecline} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving }}
        style={styles.decline}>
        <Text style={styles.declineText}>{COPY.decline}</Text>
      </Pressable>
    </View>
  );
  return <FormScreen>
    <FormScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <CalmeraWordmark style={styles.wordmark} />
      <Text accessibilityRole="header" style={styles.title}>{updated ? COPY.updatedTitle : COPY.title}</Text>
      <Text style={styles.lead}>{updated ? COPY.updatedLead : COPY.lead}</Text>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.label}>{COPY.data.heading}</Text>
        <Text style={styles.body}>{COPY.data.text}</Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.label}>{COPY.ai.heading}</Text>
        <Text style={styles.body}>{COPY.ai.text}</Text>
        <View accessibilityRole="list" style={styles.list}>
          {COPY.ai.items.map((item) => <Text key={item} style={styles.body}>{item}</Text>)}
        </View>
        <Text style={styles.note}>{COPY.ai.note}</Text>
      </View>
      {inScroll && footer}
    </FormScrollView>
    {!inScroll && footer}
    <Modal visible={Boolean(policy)} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setPolicy(null)}>
      {/* A page sheet starts below the status bar, so it needs no top inset of its own. */}
      <SafeScreenTopContext.Provider value={0}>
        {policy && <FormScreen>
          <FormHeader title={policy === "privacy" ? "Privacy policy" : "Health data policy"}
            onBack={policy === "privacy" ? undefined : () => setPolicy("privacy")}
            onSave={() => setPolicy(null)} saveTitle="Done" />
          <FormScrollView key={policy} contentContainerStyle={settingsStyles.content}>
            <PrivacyPolicyView doc={PRIVACY_DOCS[policy]} onOpenDoc={setPolicy} preview={preview} />
          </FormScrollView>
        </FormScreen>}
      </SafeScreenTopContext.Provider>
    </Modal>
  </FormScreen>;
}

// One type family at a few sizes: a large title, small capitals for each part, and body
// text big enough to read the whole agreement comfortably.
const styles = StyleSheet.create({
  content: { paddingHorizontal: EDGE, paddingTop: 20, paddingBottom: 32 },
  wordmark: { alignSelf: "flex-start", marginBottom: 40 },
  title: { fontSize: 30, fontWeight: "600", lineHeight: 36, letterSpacing: -0.6, color: SETTINGS.ink },
  lead: { fontSize: 17, fontWeight: "400", lineHeight: 24, color: SETTINGS.inkSoft, marginTop: 10 },
  section: { marginTop: 36, gap: 10 },
  label: { fontSize: 12, fontWeight: "600", lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", color: SETTINGS.inkSoft },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24, color: SETTINGS.ink },
  list: { gap: 4, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: SETTINGS.edge },
  note: { fontSize: 14, fontWeight: "400", lineHeight: 20, color: SETTINGS.inkSoft },
  footer: { paddingHorizontal: EDGE, paddingTop: 16, gap: 14 },
  inlineFooter: { paddingHorizontal: 0, marginTop: 16 },
  agreement: { fontSize: 13, fontWeight: "400", lineHeight: 19, color: SETTINGS.inkSoft },
  policyLink: { fontWeight: "500", color: SETTINGS.accent, textDecorationLine: "underline" },
  agree: { width: "100%", minHeight: 54 },
  message: { textAlign: "left" },
  notice: { color: SETTINGS.ink },
  decline: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingVertical: 6, paddingHorizontal: 12 },
  declineText: { fontSize: 15, fontWeight: "600", lineHeight: 20, color: SETTINGS.accent },
});
