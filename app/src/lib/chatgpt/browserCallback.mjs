// Expo can leave dismissBrowser pending when Safari was already dismissed.
// A cancelled browser must release the authorization attempt without dismissing twice.
export async function waitForBrowserCallback({ native, browser, url, onAuthorizationURL, development }) {
  if (onAuthorizationURL && (!development || typeof onAuthorizationURL !== "function")) {
    native.cancelCallback();
    throw new Error("development_build_required");
  }
  const callback = native.waitForCallback();
  // Consume cancellation even if launching the browser or the development handoff throws.
  callback.catch(() => {});
  let browserClosed = false;
  let browserWait;
  try {
    if (onAuthorizationURL) {
      onAuthorizationURL(url);
      return await callback;
    }
    browserWait = browser.openBrowserAsync(url).then(() => {
      browserClosed = true;
      throw new Error("authorization_cancelled");
    }, error => {
      browserClosed = true;
      throw error;
    });
    return await Promise.race([callback, browserWait]);
  } finally {
    native.cancelCallback();
    if (browserWait && !browserClosed) await browser.dismissBrowser().catch(() => {});
  }
}
