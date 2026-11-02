import { useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { AuthLink, AuthNotice, AuthScreen } from "@/components/AuthForm";
import FoodwrapLoading from "@/components/FoodwrapLoading";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { checkAccountProfile, createAccountReadyMemory } from "@/lib/accountProfile.mjs";
import { completeAccountSetup } from "@/lib/accountSetup.mjs";
import { localDateKey } from "@/lib/nutritionStore.mjs";
import { USERS_API_URL } from "@/constants/api";

const accountReady = createAccountReadyMemory(AsyncStorage);
// On a known device this check comes last, so it never competes with Today on a weak connection.
const QUIET_CHECK_DELAY_MS = 5000;

export function AccountLoadingScreen() {
  return <View style={{ flex: 1, justifyContent: "center" }}>
    <FoodwrapLoading label="Loading…" showCaption={false} />
  </View>;
}

export default function AccountProfileGate({ children, topInset = 0, disabled = false, calmeraPreview = false, calmeraPreviewState = "missing" }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const userId = user?.id;
  const { signOut } = useClerk();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const mounted = useRef(false);
  const pending = useRef(null);
  const operationRef = useRef(null);
  const previewReady = useRef(false);
  const previewChecks = useRef(0);
  const [state, setState] = useState({ phase: "checking", error: "" });
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  // A quiet check runs behind an open app, so only a confirmed missing profile interrupts it.
  const run = async (setup = false, quiet = false) => {
    if (!mounted.current || pending.current || disabled) return;
    const operation = new AbortController();
    pending.current = operation;
    const current = () => mounted.current && pending.current === operation && !operation.signal.aborted;
    const remember = ready => { if (!calmeraPreview && userId) accountReady.set(userId, ready); };
    if (!quiet) setState({ phase: setup ? "setting-up" : "checking", error: "" });
    try {
      const options = { getToken: () => tokenRef.current(), url: USERS_API_URL,
        signal: operation.signal, timeoutMs: 20000 };
      if (calmeraPreview) {
        options.getToken = async () => "synthetic-account-token";
        options.url = "https://calmera.invalid/users";
        options.pollIntervalMs = 0;
        options.fetchImpl = async (url, request = {}) => {
          if (url.endsWith("/get-user")) {
            previewChecks.current += 1;
            if (calmeraPreviewState === "error" && previewChecks.current === 1) return { ok: false, status: 503 };
            const ready = previewReady.current;
            return { ok: ready, status: ready ? 200 : 404, json: async () => ({ userId: "synthetic-user" }) };
          }
          if (url.endsWith("/create-user") && request.method === "POST") {
            previewReady.current = true;
            return { ok: true, status: 201 };
          }
          throw Error("unexpected_synthetic_account_request");
        };
      }
      if (setup) {
        const email = calmeraPreview ? "calmera@example.invalid" : user?.primaryEmailAddress?.emailAddress;
        if (!email) throw Error("account_setup_email_missing");
        await completeAccountSetup({ ...options, email, localDate: localDateKey() });
        if (current()) { setState({ phase: "ready", error: "" }); remember(true); }
      } else {
        const phase = await checkAccountProfile(options);
        if (current()) {
          if (!quiet || phase === "missing") setState({ phase, error: "" });
          remember(phase === "ready");
        }
      }
    } catch (error) {
      if (current() && !quiet) setState({ phase: "error", error: setup
        ? error.mayHaveCreated ? "We couldn’t confirm setup. Check again to continue." : "Account setup couldn’t finish. Please try again."
        : "We couldn’t check your calmera account. Check your connection and try again." });
    } finally {
      if (pending.current === operation) pending.current = null;
    }
  };
  operationRef.current = run;

  useEffect(() => {
    if (disabled) return;
    mounted.current = true;
    let quietCheck;
    (calmeraPreview || !userId ? Promise.resolve(false) : accountReady.known(userId)).then(known => {
      if (!mounted.current) return;
      if (!known) { operationRef.current(); return; }
      setState({ phase: "ready", error: "" });
      quietCheck = setTimeout(() => operationRef.current(false, true), QUIET_CHECK_DELAY_MS);
    });
    const listener = AppState.addEventListener("change", next => {
      if (next === "active" && phaseRef.current !== "ready") operationRef.current();
    });
    return () => {
      mounted.current = false;
      clearTimeout(quietCheck);
      pending.current?.abort();
      pending.current = null;
      listener.remove();
    };
  }, [disabled, calmeraPreview, userId]);

  if (disabled || state.phase === "ready") return children ?? <AuthScreen title="Setup complete" subtitle="Synthetic review. No real account records were changed." />;
  if (state.phase === "checking" || state.phase === "setting-up") return <AccountLoadingScreen topInset={topInset} />;
  return <View style={{ flex: 1, paddingTop: topInset }}><AuthScreen title={state.phase === "error" ? "Let’s reconnect your account" : "Finish account setup"}
    subtitle="You’re signed in. We’ll make sure your calmera account is ready before opening your meals.">
    <FormCard>
      <AuthNotice error>{state.error}</AuthNotice>
      {state.phase === "missing" ? <>
          <AuthNotice>Your calmera profile hasn’t been created yet. Finish setup to start logging meals.</AuthNotice>
          <GlassButton title="Finish setup" role="accent" onPress={() => run(true)} />
        </> : <GlassButton title="Check again" role="accent" onPress={() => run()} />}
      {calmeraPreview ? <Text>Synthetic account review. No real account changes.</Text>
        : <AuthLink onPress={() => signOut().catch(() => setState({ phase: "error", error: "We couldn’t sign you out. Please try again." }))}>Use a different account</AuthLink>}
    </FormCard>
  </AuthScreen></View>;
}
