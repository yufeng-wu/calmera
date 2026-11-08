import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-expo";
import { resumeAccountDeletionOnThisPhone } from "@/lib/accountDeletionDevice";

// Renders nothing. When Clerk knows who's signed in, and again whenever that changes,
// finishes clearing this phone after a deletion that was interrupted.
export default function AccountDeletionResume() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();
  useEffect(() => {
    if (!isLoaded) return;
    resumeAccountDeletionOnThisPhone({ signedInUserId: isSignedIn ? userId : null, signOut }).catch(() => {});
  }, [isLoaded, isSignedIn, userId, signOut]);
  return null;
}
