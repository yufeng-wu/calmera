import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useRef, useState } from "react";
import { styles } from "@/assets/styles/auth.styles";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { AuthField, AuthLink, AuthNotice, AuthScreen, isAuthEmail } from "@/components/AuthForm";

export default function Page({ calmeraPreview = false } = {}) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const busyRef = useRef(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = (path) => {
    if (calmeraPreview) {
      const screen = path === "/sign-up" ? "sign-up" : path === "/forgot-password" ? "forgot-password" : "sign-in";
      router.push({ pathname: "/ui-gallery", params: { page: screen } });
      return;
    }
    router.push(path);
  };
  const onSignInPress = async () => {
    if (busyRef.current || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setInfo("");
    if (!isAuthEmail(emailAddress)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    if (calmeraPreview) return setInfo("Preview sign-in complete. No authentication request was sent.");
    busyRef.current = true;
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: emailAddress.trim(), password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Your account needs an additional verification step. Please try signing in again.");
      }
    } catch (err) {
      const code = err.errors?.[0]?.code;
      if (code === "form_identifier_not_found") setError("No account found for this email address.");
      else if (code === "form_password_incorrect") setError("Invalid password. Please try again.");
      else setError(err.errors?.[0]?.longMessage || "Unable to sign in. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <AuthScreen title="Welcome back" subtitle="Sign in to your Calmera account."
    footer={<View style={styles.footer}>
      <Text style={styles.footerText}>New to Calmera?</Text>
      <AuthLink onPress={() => navigate("/sign-up")} disabled={busy}>Create an account</AuthLink>
    </View>}>
    <FormCard style={styles.form}>
      <AuthNotice error>{error}</AuthNotice>
      <AuthNotice>{info}</AuthNotice>
      <AuthField calmeraPreview={calmeraPreview} label="Email" value={emailAddress} onChangeText={setEmailAddress}
        autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
        autoComplete="email" placeholder="you@example.com" editable={!busy} error={!!error} />
      <AuthField calmeraPreview={calmeraPreview} label="Password" value={password} onChangeText={setPassword}
        secureTextEntry textContentType="password" autoComplete="current-password"
        autoCapitalize="none" placeholder="Your password" editable={!busy} error={!!error}
        returnKeyType="go" onSubmitEditing={onSignInPress} />
      <AuthLink onPress={() => navigate("/forgot-password")} style={styles.trailingLink} disabled={busy}>
        Forgot password?
      </AuthLink>
      <GlassButton title="Sign in" role="accent" onPress={onSignInPress}
        loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
    </FormCard>
    {__DEV__ && <AuthLink onPress={() => navigate("/chatgpt-test")}>
      Test ChatGPT connection · Development
    </AuthLink>}
  </AuthScreen>;
}
