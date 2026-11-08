import { Text } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { FormHeader, FormScreen, FormScrollView } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import usePageExit from "@/hooks/usePageExit";
import useProfile from "@/hooks/useProfile";
import { joinedDate } from "@/lib/accountProfile.mjs";

const PREVIEW = { email: "you@example.com", joined: "2026-10-20" };

// Who's signed in, and the way to delete the account: one tap past the email card in
// Settings, so it's easy to find without sitting beside everyday controls.
export default function Account({ calmeraPreview = false }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/settings");
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const profile = useProfile();
  const email = calmeraPreview ? PREVIEW.email : isLoaded && isSignedIn ? user?.primaryEmailAddress?.emailAddress : null;
  const joined = joinedDate(calmeraPreview ? PREVIEW.joined : profile.profile?.createdAtLocalDate);
  const openDeletion = () => calmeraPreview
    ? router.push({ pathname: "/ui-gallery", params: { page: "delete-account" } })
    : router.push("/delete-account");
  return <FormScreen>
    <FormHeader title="Account" onBack={leave} />
    <FormScrollView contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview</Text>}
      <SettingsSection>
        <SettingsRow title="Email" value={email || "–"} />
        <SettingsRow title="Joined" value={joined || "–"} divider />
      </SettingsSection>
      <SettingsSection footnote="Permanently deletes your account and everything in it.">
        <SettingsRow title="Delete account" destructive centered showAccessory={false} onPress={openDeletion} />
      </SettingsSection>
    </FormScrollView>
  </FormScreen>;
}
