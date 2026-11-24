// CALMERA_FULL_APP_TEST=1 builds the review variant. It turns on the UI gallery and the
// form fixtures, and gets its own bundle ID so it installs beside the real app.
module.exports = ({ config }) => {
  const extra = { ...config.extra };
  delete extra.calmeraFullAppTest;
  const baseConfig = { ...config, extra };
  if (process.env.CALMERA_FULL_APP_TEST !== "1") return baseConfig;
  return {
    ...baseConfig,
    extra: { ...extra, calmeraFullAppTest: true },
    scheme: "calmera-chatgpt-dev",
    ios: { ...config.ios, bundleIdentifier: "com.yfwu02.calmera.chatgptdev" },
  };
};
