import { useRef, useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { useSignUp, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { completeAccountSetup } from "@/lib/accountSetup.mjs";
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
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const router = useRouter();
  const navigation = useNavigation();
  const setupPreview = calmeraPreview && calmeraPreviewStage === "setup";
  const verificationPreview = calmeraPreview && calmeraPreviewStage === "verification";
  const busyRef = useRef(null);
  const passwordInput = useRef(null);
  const verifiedRef = useRef(setupPreview);
  // Recovery metadata stays only in this mounted flow; never render or log it.
  const verifiedSessionRef = useRef(null);
  const sessionActivatedRef = useRef(setupPreview);
  const previewSetupAttempt = useRef(0);
  const previewProfileReady = useRef(false);
  const [emailAddress, setEmailAddress] = useState(verificationPreview || setupPreview ? "calmera@example.invalid" : "");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(verificationPreview);
  const [emailVerified, setEmailVerified] = useState(setupPreview);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [info, setInfo] = useState(setupPreview ? "Synthetic setup check. No authentication or network requests are sent." : "");
  const [busy, setBusy] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const clearFieldError = (field) => {
    if (fieldError !== field) return;
    setError("");
    setFieldError("");
  };
  // Clerk setActive intentionally changes userId. This scope belongs to the
  // mounted signup flow, so that expected handoff must not cancel its own setup.
  const scope = useFormTaskScope("calmera-signup-flow", () => {
    // A focus abort cannot cancel a dispatched Clerk SDK promise. Keep that
    // mutex until its real finally settles, including after returning here.
    if (busyRef.current?.signupSettled) busyRef.current = null;
    const pending = busyRef.current;
    setBusy(Boolean(pending));
    setIsCreatingUser(pending?.signupPhase === "setup");
    setEmailVerified(verifiedRef.current);
    navigation.setOptions({ gestureEnabled: !pending });
  });
  const beginOperation = phase => {
    if (!scope.isActive() || busyRef.current) return null;
    const task = scope.start();
    if (!task) return null;
    task.signupSettled = false;
    task.signupPhase = phase;
    busyRef.current = task;
    navigation.setOptions({ gestureEnabled: false });
    setBusy(true);
    return task;
  };
  const finishOperation = (task, leaving = false) => {
    task.signupSettled = true;
    task.finish();
    if (busyRef.current !== task || leaving) return;
    busyRef.current = null;
    // Cleanup may unlock the same flow after a refocus, but stale work must not
    // apply SDK results, alerts, navigation, or a new backend setup operation.
    if (scope.isActive()) {
      setBusy(false); setIsCreatingUser(false);
      setEmailVerified(verifiedRef.current);
      navigation.setOptions({ gestureEnabled: true });
    }
  };
  const backToSignIn = () => {
    if (!scope.isActive() || busyRef.current || isCreatingUser) return;
    if (calmeraPreview) {
      router.replace({ pathname: "/ui-gallery", params: { page: "sign-in" } });
      return;
    }
    router.replace("/sign-in");
  };

  async function finishAccountSetup(task) {
    if (!task.isCurrent() || (calmeraPreview && !setupPreview)) return false;
    if (!sessionActivatedRef.current) {
      // The preview never activates any session, even if its local state changes.
      if (calmeraPreview) return false;
      task.signupPhase = "activation";
      try {
        await setActive({ session: verifiedSessionRef.current });
        // Activation may complete after blur. Record that irreversible outcome
        // for explicit recovery, but do not begin stale backend setup work.
        sessionActivatedRef.current = true;
      } catch {
        if (task.isCurrent()) setError("We couldn’t finish signing you in. Please try again.");
        return false;
      }
      if (!task.isCurrent()) return false;
    }
    task.signupPhase = "setup";
    setIsCreatingUser(true);
    try {
      // The dedicated setup preview runs the same bounded helper with fictional
      // token/fetch implementations; ordinary previews return before this phase.
      const options = {
        getToken: async () => {
          const token = await tokenRef.current();
          if (!task.isCurrent()) throw new Error("account_setup_cancelled");
          return token;
        },
        url: USERS_API_URL, email: emailAddress.trim(),
        localDate: new Date().toLocaleDateString("en-CA"), signal: task.signal,
        timeoutMs: 20000, pollCount: VERIFY_USER_CREATION_RETRY_COUNT,
        pollIntervalMs: VERIFY_USER_CREATION_RETRY_INTERVAL_MS,
      };
      if (setupPreview) {
        previewSetupAttempt.current += 1;
        options.url = "https://calmera.invalid/users";
        options.timeoutMs = previewSetupAttempt.current === 1 ? 4000 : 20000;
        options.pollIntervalMs = 0;
        options.getToken = previewSetupAttempt.current === 1
          ? () => new Promise(() => {}) : async () => "synthetic-setup-token";
        options.fetchImpl = async (url, request = {}) => {
          if (url === "https://calmera.invalid/users/get-user") return { status: previewProfileReady.current ? 200 : 404 };
          if (url === "https://calmera.invalid/users/create-user" && request.method === "POST") {
            previewProfileReady.current = true;
            return { status: 201 };
          }
          throw new Error("unexpected_synthetic_setup_request");
        };
      }
      await completeAccountSetup(options);
      if (!task.isCurrent()) return false;
      if (setupPreview) {
        setInfo("Preview setup complete. No real account, session, network, or database changes were made.");
        return false;
      }
      router.replace("/");
      return true;
    } catch (err) {
      if (task.isCurrent()) setError(err.timedOut
        ? "Account setup took too long. Please try again."
        : err.mayHaveCreated ? "We couldn’t confirm setup. Try again to check and continue."
          : "Account setup couldn’t finish. Please try again.");
      return false;
    }
  }

  const onFinishSetupPress = async () => {
    if (!verifiedRef.current || !scope.isActive() || busyRef.current) return;
    setError(""); setFieldError(""); setInfo("");
    Keyboard.dismiss();
    const task = beginOperation("setup");
    if (!task) return;
    let leaving = false;
    try { leaving = await finishAccountSetup(task); }
    finally { finishOperation(task, leaving); }
  };
  const onSignUpPress = async () => {
    if (!scope.isActive() || busyRef.current || verifiedRef.current || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setFieldError("");
    setInfo("");
    if (!isAuthEmail(emailAddress)) { setFieldError("email"); return setError("Enter a valid email address."); }
    if (!password) { setFieldError("password"); return setError("Choose a password for your account."); }
    Keyboard.dismiss();
    if (calmeraPreview) {
      setInfo("Preview verification. No email or account creation request was sent.");
      setPendingVerification(true);
      return;
    }
    const task = beginOperation("signup");
    if (!task) return;
    try {
      await signUp.create({ emailAddress: emailAddress.trim(), password });
      if (!task.isCurrent()) return;
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      if (task.isCurrent()) setPendingVerification(true);
    } catch (err) {
      if (!task.isCurrent()) return;
      if (err.errors?.[0]?.code === "form_identifier_exists") { setFieldError("email"); setError("Email already in use."); }
      else setError(err.errors?.[0]?.longMessage || "Unable to create your account. Please try again.");
    } finally { finishOperation(task); }
  };

  const onVerifyPress = async () => {
    if (!scope.isActive() || busyRef.current || verifiedRef.current || (!calmeraPreview && !isLoaded)) return;
    setError("");
    setFieldError("");
    setInfo("");
    if (!code.trim()) { setFieldError("code"); return setError("Enter the verification code from your email."); }
    Keyboard.dismiss();
    if (calmeraPreview) return setInfo("Preview verification complete. No authentication or database request was sent.");
    const task = beginOperation("verification");
    if (!task) return;
    let leaving = false;
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === "complete") {
        // Verification cannot be undone on blur. Keep its session handle for a
        // later explicit Finish setup action, without activating stale work.
        verifiedRef.current = true;
        verifiedSessionRef.current = attempt.createdSessionId;
      }
      if (!task.isCurrent()) return;
      if (attempt.status !== "complete") {
        setError("Verification is not complete. Check the code and try again.");
        return;
      }
      setEmailVerified(true);
      leaving = await finishAccountSetup(task);
    } catch (err) {
      if (task.isCurrent()) setError(err.errors?.[0]?.longMessage || "Unable to verify this code. Please try again.");
    } finally { finishOperation(task, leaving); }
  };

  return <AuthScreen title={emailVerified ? "Finish account setup" : pendingVerification ? "Check your email" : "Create your account"}
    subtitle={emailVerified ? "Your email is verified. Finish setting up your foodwrap account."
      : pendingVerification ? `Enter the verification code sent to ${emailAddress}.` : "A little awareness, one meal at a time."}
    onBack={backToSignIn} backDisabled={busy || isCreatingUser}
    footer={<View style={styles.footer}>
      <Text style={styles.footerText}>Already have an account?</Text>
      <AuthLink onPress={backToSignIn} disabled={busy || isCreatingUser}>Sign in</AuthLink>
    </View>}>
    <FormCard style={styles.form}>
      <AuthNotice error>{error}</AuthNotice>
      <AuthNotice>{info}</AuthNotice>
      {isCreatingUser ? <AuthBusy>Setting up your foodwrap account…</AuthBusy> : emailVerified ? <GlassButton
        title="Finish account setup" role="accent" onPress={onFinishSetupPress} loading={busy} style={styles.action} /> : pendingVerification ? <>
        <AuthField calmeraPreview={calmeraPreview} label="Verification code" code value={code} onChangeText={(value) => { setCode(value); clearFieldError("code"); }}
          placeholder="Email code" keyboardType="number-pad" textContentType="oneTimeCode"
          autoComplete="one-time-code" editable={!busy} error={fieldError === "code"}
          returnKeyType="done" onSubmitEditing={onVerifyPress} />
        <GlassButton title="Verify email" role="accent" onPress={onVerifyPress}
          loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
      </> : <>
        <AuthField calmeraPreview={calmeraPreview} label="Email" value={emailAddress} onChangeText={(value) => { setEmailAddress(value); clearFieldError("email"); }}
          autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
          autoComplete="email" placeholder="you@example.com" editable={!busy} error={fieldError === "email"}
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} />
        <AuthField ref={passwordInput} calmeraPreview={calmeraPreview} label="Password" value={password} onChangeText={(value) => { setPassword(value); clearFieldError("password"); }} secureTextEntry
          textContentType="newPassword" autoComplete="new-password" autoCapitalize="none"
          placeholder="Choose a password" editable={!busy} error={fieldError === "password"}
          returnKeyType="go" onSubmitEditing={onSignUpPress} />
        <GlassButton title="Create account" role="accent" onPress={onSignUpPress}
          loading={busy} disabled={!calmeraPreview && !isLoaded} style={styles.action} />
      </>}
    </FormCard>
  </AuthScreen>;
}
