const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force Metro to resolve 'react-native-fs' to a JS stub so we can run in Expo Go.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "react-native-fs": path.resolve(__dirname, "shim/react-native-fs.js"),
};

// Ensure Metro bundles .bin weight shards and .tflite etc.
config.resolver.assetExts = config.resolver.assetExts || [];
if (!config.resolver.assetExts.includes("bin")) {
  config.resolver.assetExts.push("bin");
}

module.exports = config;
