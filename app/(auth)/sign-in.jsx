import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { ACCOUNT_NOTICES, accountNotice } from "@/lib/accountNotice.mjs";
import { styles } from "@/assets/styles/auth.styles";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { AuthField, AuthLink, AuthNotice, AuthScreen, isAuthEmail } from "@/components/AuthForm";

export default function Page({ calmeraPreview = false } = {}) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const busyRef = useRef(false);
  const passwordInput = useRef(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [info, setInfo] = useState("");
  // Set once by an account deletion, which signs out just before or after this mounts.
  const [notice, setNotice] = useState(() => ACCOUNT_NOTICES[accountNotice.take()] ?? "");
  useEffect(() => accountNotice.subscribe(() => setNotice(ACCOUNT_NOTICES[accountNotice.take()] ?? "")), []);
  const [busy, setBusy] = useState(false);

  const clearFieldError = (field) => {
    if (fieldError !== field) return;
    setError("");
    setFieldError("");
  };

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
    setFieldError("");
    setInfo("");
    setNotice("");
    if (!isAuthEmail(emailAddress)) { setFieldError("email"); return setError("Enter a valid email address."); }
    if (!password) { setFieldError("password"); return setError("Enter your password."); }
    if (calmeraPreview) return setInfo("Preview sign-in complete. No authentication request was sent.");
    busyRef.current = true;
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: emailAddress.trim(), password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Sign-in needs another step. This version of calmera can’t complete it yet.");
      }
    } catch (err) {
      const code = err.errors?.[0]?.code;
      if (code === "form_identifier_not_found") { setFieldError("email"); setError("No account found for this email address."); }
      else if (code === "form_password_incorrect") { setFieldError("password"); setError("Invalid password. Please try again."); }
      else setError(err.errors?.[0]?.longMessage || "Unable to sign in. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <AuthScreen title="Welcome back" subtitle="Sign in to your calmera account."
    footer={<View style={styles.footer}>
      <Text style={styles.footerText}>New to calmera?</Text>
      <AuthLink onPress={() => navigate("/sign-up")} disabled={busy}>Create an account</AuthLink>
    </View>}>
    <FormCard style={styles.form}>
      <AuthNotice error>{error}</AuthNotice>
      <AuthNotice>{info || notice}</AuthNotice>
      <AuthField calmeraPreview={calmeraPreview} label="Email" value={emailAddress} onChangeText={(value) => { setEmailAddress(value); clearFieldError("email"); }}
        autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
        autoComplete="email" placeholder="you@example.com" editable={!busy} error={fieldError === "email"}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} />
      <AuthField ref={passwordInput} calmeraPreview={calmeraPreview} label="Password" value={password} onChangeText={(value) => { setPassword(value); clearFieldError("password"); }}
        secureTextEntry textContentType="password" autoComplete="current-password"
        autoCapitalize="none" placeholder="Your password" editable={!busy} error={fieldError === "password"}
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
