// Calmera is free: neither the normal app nor the isolated probe needs Apple
// Pay entitlements or Stripe configuration. Keep the original app.json intact.
module.exports = ({ config }) => {
  const extra = { ...config.extra };
  delete extra.stripe;
  delete extra.calmeraFullAppTest;
  const freeConfig = {
    ...config,
    plugins: (config.plugins || []).filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== "@stripe/stripe-react-native"),
    extra,
  };
  if (process.env.CALMERA_FULL_APP_TEST === "1") return {
    ...freeConfig,
    name: "Calmera Test",
    extra: { ...extra, calmeraFullAppTest: true },
    scheme: "calmera-chatgpt-dev",
    ios: { ...config.ios, bundleIdentifier: "com.yfwu02.mobile.chatgptdev" },
  };
  if (process.env.CALMERA_PHONE_TEST !== "1") return freeConfig;
  return {
    ...freeConfig,
    name: "Calmera AI Test",
    scheme: "calmera-ai-test",
    ios: { ...config.ios, bundleIdentifier: "com.yfwu02.mobile.chatgpttest", buildNumber: "1" },
  };
};
