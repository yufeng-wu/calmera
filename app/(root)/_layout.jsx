import { useUser } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { StripeProvider } from "@stripe/stripe-react-native";
import Constants from "expo-constants";
import { EntriesRefreshProvider } from "@/context/EntriesRefreshContext";

export default function Layout() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null; // this is for better ux.
  if (!isSignedIn) {
    return <Redirect href={"/sign-in"} />;
  }

  return (
    <StripeProvider
      publishableKey={Constants.expoConfig.extra.stripe.publishableKey}
      merchantIdentifier={Constants.expoConfig.extra.stripe.merchantIdentifier}
    >
      <EntriesRefreshProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </EntriesRefreshProvider>
    </StripeProvider>
  );
}
