import { useUser } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { EntriesRefreshProvider } from "@/context/EntriesRefreshContext";

export default function Layout() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null; // this is for better ux.
  if (!isSignedIn) {
    return <Redirect href={"/sign-in"} />;
  }

  return (
    <EntriesRefreshProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </EntriesRefreshProvider>
  );
}
