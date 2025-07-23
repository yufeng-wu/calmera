// Minimal stub for `react-native-fs` so that tfjs-react-native's
// dynamic `require('react-native-fs')` resolves in Expo Go, which
// does not include the native RNFS module. The TFJS code falls back
// to fetch()/expo-file-system when RNFS is missing; we just need to
// avoid a Metro "Unable to resolve module" error.

export default {};
