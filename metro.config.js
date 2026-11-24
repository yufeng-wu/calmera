const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ensure Metro bundles .bin weight shards and .tflite etc.
config.resolver.assetExts = config.resolver.assetExts || [];
if (!config.resolver.assetExts.includes("bin")) {
  config.resolver.assetExts.push("bin");
}
if (!config.resolver.assetExts.includes("json")) {
  config.resolver.assetExts.push("json");
}

module.exports = config;
