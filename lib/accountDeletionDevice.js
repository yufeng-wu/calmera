import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DELETE_ACCOUNT_API_URL } from "@/constants/api";
import { clearLocalAccountData, createAccountDeletion, requestAccountDeletion, resumeAccountDeletion } from "@/lib/accountDeletion.mjs";
import { accountNotice } from "@/lib/accountNotice.mjs";
import { createPlanClient } from "@/lib/chatgpt/planClient";

// The phone's side of deleting an account: its storage, keychain and ChatGPT connection.
let active = false;

export const clearThisPhone = (userId) => clearLocalAccountData({
  userId, asyncStorage: AsyncStorage, secureStore: SecureStore,
  disconnectChatGPT: () => createPlanClient(userId).disconnect(),
});

export function startAccountDeletion({ userId, getToken, signOut }) {
  const run = createAccountDeletion({
    userId, storage: AsyncStorage, signOut, cleanup: clearThisPhone, notify: accountNotice.set,
    request: (options) => requestAccountDeletion({ getToken, url: DELETE_ACCOUNT_API_URL, ...options }),
  });
  return async () => {
    active = true;
    try { return await run(); }
    finally { active = false; }
  };
}

// The deletion in progress finishes its own cleanup; this picks up one that was interrupted.
export function resumeAccountDeletionOnThisPhone({ signedInUserId, signOut }) {
  if (active) return Promise.resolve(null);
  return resumeAccountDeletion({ storage: AsyncStorage, signedInUserId, signOut, cleanup: clearThisPhone });
}
