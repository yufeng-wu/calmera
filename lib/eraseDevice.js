import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import RNFS from "react-native-fs";
import { createPlanClient } from "@/lib/chatgpt/planClient";
import { eraseThisPhone } from "@/lib/eraseData.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";

const cacheFiles = {
  list: () => RNFS.readDir(RNFS.CachesDirectoryPath),
  remove: (path) => RNFS.unlink(path),
};

// Erase all data: meals, goals and the profile through the data module first, so its
// copy in memory goes too, then everything else calmera keeps on this iPhone.
export async function eraseAllData(data) {
  await data.eraseAll();
  return eraseThisPhone({ asyncStorage: AsyncStorage, secureStore: SecureStore, cacheFiles,
    disconnectChatGPT: () => createPlanClient(LOCAL_OWNER).disconnect() });
}
