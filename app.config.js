// Calmera is free and takes no payments. The test variants below get their own
// bundle IDs so they install beside the real app.
module.exports = ({ config }) => {
  const extra = { ...config.extra };
  delete extra.calmeraFullAppTest;
  const baseConfig = { ...config, extra };
  if (process.env.CALMERA_FULL_APP_TEST === "1") return {
    ...baseConfig,
    name: "calmera.",
    extra: { ...extra, calmeraFullAppTest: true },
    scheme: "calmera-chatgpt-dev",
    ios: { ...config.ios, bundleIdentifier: "com.yfwu02.calmera.chatgptdev" },
  };
  if (process.env.CALMERA_PHONE_TEST !== "1") return baseConfig;
  return {
    ...baseConfig,
    name: "calmera.",
    scheme: "calmera-ai-test",
    ios: { ...config.ios, bundleIdentifier: "com.yfwu02.calmera.chatgpttest", buildNumber: "1" },
  };
};
