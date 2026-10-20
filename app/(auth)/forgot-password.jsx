import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Keyboard, Text, View } from "react-native";
import { styles } from "@/assets/styles/auth.styles";
import { createPasswordResetOutcome } from "@/lib/passwordResetOutcome.mjs";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { AuthField, AuthLink, AuthNotice, AuthScreen, isAuthEmail } from "@/components/AuthForm";

export default function ForgotPassword({ calmeraPreview = false, calmeraPreviewStage = "" } = {}) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const busyRef = useRef(null);
  const focus = useRef({ active: false, generation: 0 });
  const resetOutcome = useRef(null);
  if (!resetOutcome.current) resetOutcome.current = createPasswordResetOutcome();
  const activationFailurePreview = calmeraPreview && calmeraPreviewStage === "activation-failure";
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stage, setStage] = useState(calmeraPreview && ["reset", "activation-failure"].includes(calmeraPreviewStage) ? "RESET"
    : calmeraPreview && calmeraPreviewStage === "verification" ? "VERIFY" : "REQUEST");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const syncResetPresentation = useCallback(() => {
    if (!resetOutcome.current.hasCompletedReset()) return;
    setNewPassword("");
    setPasswordUpdated(true);
    setInfo("");
    if (resetOutcome.current.getOutcome()?.kind === "activation-failed") {
      setError("Your password was updated, but we couldn’t sign you in. Sign in with your new password.");
    }
  }, []);
  useFocusEffect(useCallback(() => {
    focus.current.active = true;
    focus.current.generation += 1;
    // SDK work cannot be cancelled by hiding the screen. Keep its mutex until
    // actual settlement, and restore only current presentation on refocus.
    setBusy(Boolean(busyRef.current));
    syncResetPresentation();
    return () => { focus.current.active = false; focus.current.generation += 1; };
  }, [syncResetPresentation]));
  const isCurrent = ticket => focus.current.active && ticket.generation === focus.current.generation;

  const clearFieldError = (field) => {
    if (fieldError !== field) return;
    setError("");
    setFieldError("");
  };

  const backToSignIn = () => {
    if (!focus.current.active || busyRef.current) return;
    if (calmeraPreview) {
      router.replace({ pathname: "/ui-gallery", params: { page: "sign-in" } });
      return;
    }
    router.replace("/sign-in");
  };
  const submit = async () => {
    if (!focus.current.active || busyRef.current || resetOutcome.current.hasCompletedReset() || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setFieldError("");
    setInfo("");
    if (stage === "REQUEST" && !isAuthEmail(emailAddress)) { setFieldError("email"); return setError("Enter a valid email address."); }
    if (stage === "VERIFY" && !code.trim()) { setFieldError("code"); return setError("Enter the code from your email."); }
    if (stage === "RESET" && !activationFailurePreview && newPassword.length < 8) { setFieldError("password"); return setError("Choose a password with at least 8 characters."); }
    Keyboard.dismiss();
    if (calmeraPreview && !activationFailurePreview) {
      if (stage === "REQUEST") {
        setStage("VERIFY");
        setInfo("Preview code entry. No reset email was sent.");
      } else if (stage === "VERIFY") {
        setStage("RESET");
        setInfo("Preview new password entry. No code was verified.");
      } else setInfo("Preview reset complete. No password or session was changed.");
      return;
    }
    const ticket = { generation: focus.current.generation };
    busyRef.current = ticket;
    setBusy(true);
    try {
      if (stage === "REQUEST" && !activationFailurePreview) {
        await signIn.create({ identifier: emailAddress.trim(), strategy: "reset_password_email_code" });
        if (!isCurrent(ticket)) return;
        setStage("VERIFY");
        setInfo("We've sent a verification code to your email.");
      } else if (stage === "VERIFY" && !activationFailurePreview) {
        const attempt = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code: code.trim() });
        if (!isCurrent(ticket)) return;
        if (attempt.status === "needs_new_password") {
          setStage("RESET");
          setInfo("Code verified. Choose your new password.");
        } else setError("Verification is not complete. Please check the code and try again.");
      } else {
        const outcome = await resetOutcome.current.run({
          isActive: () => isCurrent(ticket),
          resetPassword: activationFailurePreview
            ? async () => ({ status: "complete", createdSessionId: "synthetic-reset-session" })
            : () => signIn.resetPassword({ password: newPassword }),
          activateSession: activationFailurePreview
            ? async () => { throw new Error("synthetic_activation_failure"); }
            : session => setActive({ session }),
          onResetComplete: () => {
            // Erase the secret even from an offscreen mounted form; stale work
            // must not revive success/error presentation or navigation.
            setNewPassword("");
            if (isCurrent(ticket)) syncResetPresentation();
          },
        });
        if (!isCurrent(ticket)) return;
        if (outcome.kind === "complete") router.replace("/");
        else if (outcome.kind === "activation-failed") {
          setError("Your password was updated, but we couldn’t sign you in. Sign in with your new password.");
        } else setError(outcome.kind === "reset-incomplete"
          ? "Unable to complete your password reset. Please try again."
          : "Unable to reset your password. Please ensure it meets the requirements.");
      }
    } catch {
      if (!isCurrent(ticket)) return;
      if (resetOutcome.current.hasCompletedReset()) {
        setError("Your password was updated. Continue when you’re ready.");
        return;
      }
      setError(stage === "REQUEST" ? "Unable to send a reset code. Check the email address and try again."
        : stage === "VERIFY" ? "Couldn’t verify the code. Please try again."
          : "Unable to reset your password. Please ensure it meets the requirements.");
    } finally {
      if (busyRef.current === ticket) {
        busyRef.current = null;
        if (focus.current.active) { setBusy(false); syncResetPresentation(); }
      }
    }
  };

  const title = stage === "REQUEST" ? "Reset your password" : stage === "VERIFY" ? "Check your email" : "Choose a new password";
  const subtitle = stage === "REQUEST" ? "We'll email you a code to get back into your account."
    : stage === "VERIFY" ? "Enter the verification code from your reset email."
      : "Use a strong password you haven't used before.";

  const completedSuccessfully = passwordUpdated && resetOutcome.current.getOutcome()?.kind === "complete";
  const continueAfterReset = () => {
    if (!focus.current.active || busyRef.current) return;
    if (completedSuccessfully && !calmeraPreview) router.replace("/");
    else backToSignIn();
  };

  return <AuthScreen title={passwordUpdated ? "Password updated" : title}
    subtitle={passwordUpdated ? (busy ? "Finishing sign-in…" : completedSuccessfully ? "Continue to Calmera." : "Continue to sign in.") : subtitle} onBack={backToSignIn} backDisabled={busy}
    footer={passwordUpdated ? null : <View style={styles.footer}>
      <Text style={styles.footerText}>Remember your password?</Text>
      <AuthLink onPress={backToSignIn} disabled={busy}>Sign in</AuthLink>
    </View>}>
    <FormCard style={styles.form}>
      <AuthNotice error>{error}</AuthNotice>
      <AuthNotice>{info}</AuthNotice>
      {passwordUpdated ? null : stage === "REQUEST" ? <AuthField key={stage} calmeraPreview={calmeraPreview} label="Email" value={emailAddress} onChangeText={(value) => { setEmailAddress(value); clearFieldError("email"); }}
        autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
        autoComplete="email" placeholder="you@example.com" editable={!busy} error={fieldError === "email"}
        returnKeyType="go" onSubmitEditing={submit} />
        : stage === "VERIFY" ? <AuthField key={stage} calmeraPreview={calmeraPreview} label="Verification code" code value={code} onChangeText={(value) => { setCode(value); clearFieldError("code"); }}
          keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
          placeholder="Email code" editable={!busy} error={fieldError === "code"} returnKeyType="done" onSubmitEditing={submit} />
          : <AuthField key={stage} calmeraPreview={calmeraPreview} label="New password" value={newPassword} onChangeText={(value) => { setNewPassword(value); clearFieldError("password"); }}
            secureTextEntry autoCapitalize="none" textContentType="newPassword" autoComplete="new-password"
            placeholder="New password" hint="At least 8 characters." editable={!busy} error={fieldError === "password"}
            returnKeyType="go" onSubmitEditing={submit} />}
      <GlassButton title={passwordUpdated ? (completedSuccessfully ? "Continue" : "Sign in") : stage === "REQUEST" ? "Send reset code" : stage === "VERIFY" ? "Verify code" : "Reset password"}
        role="accent" onPress={passwordUpdated ? continueAfterReset : submit} loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
    </FormCard>
  </AuthScreen>;
}
