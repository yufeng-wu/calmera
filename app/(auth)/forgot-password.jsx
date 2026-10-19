import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { styles } from "@/assets/styles/auth.styles";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { AuthField, AuthLink, AuthNotice, AuthScreen, isAuthEmail } from "@/components/AuthForm";

export default function ForgotPassword({ calmeraPreview = false, calmeraPreviewStage = "" } = {}) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const busyRef = useRef(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stage, setStage] = useState(calmeraPreview && calmeraPreviewStage === "reset" ? "RESET"
    : calmeraPreview && calmeraPreviewStage === "verification" ? "VERIFY" : "REQUEST");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const backToSignIn = () => {
    if (busyRef.current) return;
    if (calmeraPreview) {
      router.replace({ pathname: "/ui-gallery", params: { page: "sign-in" } });
      return;
    }
    router.replace("/sign-in");
  };
  const submit = async () => {
    if (busyRef.current || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setInfo("");
    if (stage === "REQUEST" && !isAuthEmail(emailAddress)) return setError("Enter a valid email address.");
    if (stage === "VERIFY" && !code.trim()) return setError("Enter the code from your email.");
    if (stage === "RESET" && newPassword.length < 8) return setError("Choose a password with at least 8 characters.");
    Keyboard.dismiss();
    if (calmeraPreview) {
      if (stage === "REQUEST") {
        setStage("VERIFY");
        setInfo("Preview code entry. No reset email was sent.");
      } else if (stage === "VERIFY") {
        setStage("RESET");
        setInfo("Preview new password entry. No code was verified.");
      } else setInfo("Preview reset complete. No password or session was changed.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (stage === "REQUEST") {
        await signIn.create({ identifier: emailAddress.trim(), strategy: "reset_password_email_code" });
        setStage("VERIFY");
        setInfo("We've sent a verification code to your email.");
      } else if (stage === "VERIFY") {
        const attempt = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code: code.trim() });
        if (attempt.status === "needs_new_password") {
          setStage("RESET");
          setInfo("Code verified. Choose your new password.");
        } else setError("Verification is not complete. Please check the code and try again.");
      } else {
        const result = await signIn.resetPassword({ password: newPassword });
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          router.replace("/");
        } else setError("Unable to complete your password reset. Please try again.");
      }
    } catch {
      setError(stage === "REQUEST" ? "Unable to send a reset code. Check the email address and try again."
        : stage === "VERIFY" ? "Invalid code. Please try again."
          : "Unable to reset your password. Please ensure it meets the requirements.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const title = stage === "REQUEST" ? "Reset your password" : stage === "VERIFY" ? "Check your email" : "Choose a new password";
  const subtitle = stage === "REQUEST" ? "We'll email you a code to get back into your account."
    : stage === "VERIFY" ? "Enter the verification code from your reset email."
      : "Use a strong password you haven't used before.";

  return <AuthScreen title={title} subtitle={subtitle} onBack={backToSignIn} backDisabled={busy}
    footer={<View style={styles.footer}>
      <Text style={styles.footerText}>Remember your password?</Text>
      <AuthLink onPress={backToSignIn} disabled={busy}>Sign in</AuthLink>
    </View>}>
    <FormCard style={styles.form}>
      <AuthNotice error>{error}</AuthNotice>
      <AuthNotice>{info}</AuthNotice>
      {stage === "REQUEST" ? <AuthField calmeraPreview={calmeraPreview} label="Email" value={emailAddress} onChangeText={setEmailAddress}
        autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
        autoComplete="email" placeholder="you@example.com" editable={!busy} error={!!error}
        returnKeyType="go" onSubmitEditing={submit} />
        : stage === "VERIFY" ? <AuthField calmeraPreview={calmeraPreview} label="Verification code" code value={code} onChangeText={setCode}
          keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
          placeholder="Email code" editable={!busy} error={!!error} returnKeyType="done" onSubmitEditing={submit} />
          : <AuthField calmeraPreview={calmeraPreview} label="New password" value={newPassword} onChangeText={setNewPassword}
            secureTextEntry autoCapitalize="none" textContentType="newPassword" autoComplete="new-password"
            placeholder="New password" hint="At least 8 characters." editable={!busy} error={!!error}
            returnKeyType="go" onSubmitEditing={submit} />}
      <GlassButton title={stage === "REQUEST" ? "Send reset code" : stage === "VERIFY" ? "Verify code" : "Reset password"}
        role="accent" onPress={submit} loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
    </FormCard>
  </AuthScreen>;
}
