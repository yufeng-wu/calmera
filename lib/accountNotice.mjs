// One message for the sign-in screen after an account is deleted, shown once. It lives in
// memory: the deletion signs out first, so Sign In may mount before or after it's set.
export const ACCOUNT_NOTICES = Object.freeze({
  "account-deleted": "Your account has been deleted.",
  "deletion-unconfirmed": "You’ve been signed out. If you can still sign in, your account wasn’t deleted; try again from Settings.",
});

export function createAccountNotice() {
  let current = null;
  const listeners = new Set();
  return {
    set(value) {
      current = value;
      listeners.forEach((listener) => listener(value));
    },
    take() {
      const value = current;
      current = null;
      return value;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const accountNotice = createAccountNotice();
