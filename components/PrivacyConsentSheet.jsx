import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthLink } from "@/components/AuthForm";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import { FormHeader, FormScreen, FormScrollView, GlassButton } from "@/components/GlassForm";
import OpenAILogo from "@/components/OpenAILogo";
import PrivacyPolicyView from "@/components/PrivacyPolicyView";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { SettingsSection, SettingsTile, settingsStyles } from "@/components/SettingsSection";
import { SETTINGS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { CONSENT_COPY as COPY, PRIVACY_DOCS } from "@/lib/privacyPolicy.mjs";

// The agreement names the policy once; that phrase opens it.
const POLICY_LINK = "Privacy Policy";
const [before, after] = COPY.agreement.split(POLICY_LINK);
const SENT = [["create", COPY.ai.items[0]], ["image", COPY.ai.items[1]], ["mic", COPY.ai.items[2]]];

// Shown once to everyone before calmera opens, and again after a material policy change:
// what we keep, what goes to OpenAI, the full policy, and one explicit choice.
export default function PrivacyConsentSheet({ updated = false, saving = false, error = "", onAgree, onDecline, preview = false }) {
  const { bottom } = useSafeAreaInsets();
  const [policy, setPolicy] = useState(null);
  return <FormScreen>
    <FormScrollView contentContainerStyle={[settingsStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      <FoodwrapWordmark style={styles.wordmark} />
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>{updated ? COPY.updatedTitle : COPY.title}</Text>
        <Text style={styles.lead}>{updated ? COPY.updatedLead : COPY.lead}</Text>
      </View>
      <SettingsSection>
        <Point icon="lock-closed" tint="tangerine" heading={COPY.data.heading}>
          <Text style={styles.body}>{COPY.data.text}</Text>
        </Point>
      </SettingsSection>
      <SettingsSection>
        <Point iconElement={<OpenAILogo />} tint="cocoa" heading={COPY.ai.heading}>
          <Text style={styles.body}>{COPY.ai.text}</Text>
          <View accessibilityRole="list" style={styles.sent}>
            {SENT.map(([icon, text]) => <View key={text} style={styles.sentItem}>
              <Ionicons name={icon} size={16} color={SETTINGS.inkSoft} />
              <Text style={[styles.body, styles.sentText]}>{text}</Text>
            </View>)}
          </View>
          <Text style={styles.note}>{COPY.ai.note}</Text>
        </Point>
      </SettingsSection>
    </FormScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) }]}>
      <Text style={styles.agreement}>
        {before}<Text accessibilityRole="link" accessibilityHint="Opens the Privacy Policy" suppressHighlighting={false}
          onPress={() => setPolicy("privacy")} style={styles.policyLink}>{POLICY_LINK}</Text>{after}
      </Text>
      <GlassButton title={COPY.agree} role="accent" onPress={onAgree} loading={saving} disabled={saving} style={styles.agree} />
      {!!error && <Text accessibilityLiveRegion="assertive" style={[settingsStyles.problem, styles.centered]}>{error}</Text>}
      <AuthLink onPress={onDecline} disabled={saving} style={styles.decline}>{COPY.decline}</AuthLink>
    </View>
    <Modal visible={Boolean(policy)} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setPolicy(null)}>
      {/* A page sheet starts below the status bar, so it needs no top inset of its own. */}
      <SafeScreenTopContext.Provider value={0}>
        {policy && <FormScreen>
          <FormHeader title={policy === "privacy" ? "Privacy Policy" : "Health Data Policy"}
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

function Point({ icon, iconElement, tint, heading, children }) {
  return <View style={styles.point}>
    <SettingsTile icon={icon} tint={tint}>{iconElement}</SettingsTile>
    <View style={styles.pointCopy}>
      <Text accessibilityRole="header" style={styles.heading}>{heading}</Text>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24 },
  wordmark: { alignSelf: "center", marginTop: 8 },
  hero: { gap: 6, marginHorizontal: 4, alignItems: "center" },
  title: { ...TYPOGRAPHY.authTitle, color: SETTINGS.ink, textAlign: "center" },
  lead: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft, textAlign: "center" },
  point: { flexDirection: "row", gap: SETTINGS.rowGap, padding: SETTINGS.rowPadding },
  pointCopy: { flex: 1, gap: 6 },
  heading: { ...TYPOGRAPHY.sectionTitle, color: SETTINGS.ink },
  body: { ...TYPOGRAPHY.body, color: SETTINGS.ink },
  sent: { gap: 8, marginVertical: 4 },
  sentItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  sentText: { flex: 1 },
  note: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft },
  footer: { paddingHorizontal: SETTINGS.gutter, paddingTop: 12, gap: 10 },
  agreement: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, textAlign: "center", marginHorizontal: 4 },
  policyLink: { ...TYPOGRAPHY.captionMedium, color: SETTINGS.accent, textDecorationLine: "underline" },
  agree: { width: "100%", minHeight: 52 },
  centered: { textAlign: "center" },
  decline: { alignSelf: "center" },
});
