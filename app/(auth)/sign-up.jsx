import { useRef, useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { useSignUp, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { styles } from "@/assets/styles/auth.styles";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { AuthBusy, AuthField, AuthLink, AuthNotice, AuthScreen, isAuthEmail } from "@/components/AuthForm";
import {
  USERS_API_URL,
  VERIFY_USER_CREATION_RETRY_COUNT,
  VERIFY_USER_CREATION_RETRY_INTERVAL_MS,
} from "../../constants/api.js";

export default function SignUpScreen({ calmeraPreview = false, calmeraPreviewStage = "" } = {}) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { getToken } = useAuth();
  const router = useRouter();
  const busyRef = useRef(false);
  const [emailAddress, setEmailAddress] = useState(calmeraPreview && calmeraPreviewStage === "verification" ? "calmera@example.invalid" : "");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(calmeraPreview && calmeraPreviewStage === "verification");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const backToSignIn = () => {
    if (busyRef.current || isCreatingUser) return;
    if (calmeraPreview) {
      router.replace({ pathname: "/ui-gallery", params: { page: "sign-in" } });
      return;
    }
    router.replace("/sign-in");
  };
  const onSignUpPress = async () => {
    if (busyRef.current || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setInfo("");
    if (!isAuthEmail(emailAddress)) return setError("Enter a valid email address.");
    if (!password) return setError("Choose a password for your account.");
    Keyboard.dismiss();
    if (calmeraPreview) {
      setInfo("Preview verification. No email or account creation request was sent.");
      setPendingVerification(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await signUp.create({ emailAddress: emailAddress.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      if (err.errors?.[0]?.code === "form_identifier_exists") setError("Email already in use.");
      else setError(err.errors?.[0]?.longMessage || "Unable to create your account. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onVerifyPress = async () => {
    if (busyRef.current || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setInfo("");
    if (!code.trim()) return setError("Enter the verification code from your email.");
    Keyboard.dismiss();
    if (calmeraPreview) return setInfo("Preview verification complete. No authentication or database request was sent.");
    busyRef.current = true;
    setBusy(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status !== "complete") {
        setError("Verification is not complete. Check the code and try again.");
        return;
      }
      await setActive({ session: attempt.createdSessionId });
      setIsCreatingUser(true);
      try {
        const token = await getToken();
        await fetch(`${USERS_API_URL}/create-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: emailAddress.trim(), username: emailAddress.trim().split("@")[0],
            localDate: new Date().toLocaleDateString("en-CA"),
          }),
        });
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let created = false;
        for (let i = 0; i < VERIFY_USER_CREATION_RETRY_COUNT; i++) {
          const response = await fetch(`${USERS_API_URL}/get-user`, {
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          });
          if (response.ok) { created = true; break; }
          await wait(VERIFY_USER_CREATION_RETRY_INTERVAL_MS);
        }
        if (!created) throw new Error("User not available after creation retries");
        router.replace("/");
      } catch {
        setError("Your email is verified, but Calmera account setup could not finish. Please try signing in.");
      } finally {
        setIsCreatingUser(false);
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || "Unable to verify this code. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <AuthScreen title={pendingVerification ? "Check your email" : "Create your account"}
    subtitle={pendingVerification ? `Enter the verification code sent to ${emailAddress}.` : "A little awareness, one meal at a time."}
    onBack={backToSignIn} backDisabled={busy || isCreatingUser}
    footer={<View style={styles.footer}>
      <Text style={styles.footerText}>Already have an account?</Text>
      <AuthLink onPress={backToSignIn} disabled={busy || isCreatingUser}>Sign in</AuthLink>
    </View>}>
    <FormCard style={styles.form}>
      <AuthNotice error>{error}</AuthNotice>
      <AuthNotice>{info}</AuthNotice>
      {isCreatingUser ? <AuthBusy>Setting up your Calmera account…</AuthBusy> : pendingVerification ? <>
        <AuthField calmeraPreview={calmeraPreview} label="Verification code" code value={code} onChangeText={setCode}
          placeholder="Email code" keyboardType="number-pad" textContentType="oneTimeCode"
          autoComplete="one-time-code" editable={!busy} error={!!error}
          returnKeyType="done" onSubmitEditing={onVerifyPress} />
        <GlassButton title="Verify email" role="accent" onPress={onVerifyPress}
          loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
      </> : <>
        <AuthField calmeraPreview={calmeraPreview} label="Email" value={emailAddress} onChangeText={setEmailAddress}
          autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
          autoComplete="email" placeholder="you@example.com" editable={!busy} error={!!error} />
        <AuthField calmeraPreview={calmeraPreview} label="Password" value={password} onChangeText={setPassword} secureTextEntry
          textContentType="newPassword" autoComplete="new-password" autoCapitalize="none"
          placeholder="Choose a password" editable={!busy} error={!!error}
          returnKeyType="go" onSubmitEditing={onSignUpPress} />
        <GlassButton title="Create account" role="accent" onPress={onSignUpPress}
          loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
      </>}
    </FormCard>
  </AuthScreen>;
}
