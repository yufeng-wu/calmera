import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUsageLog } from "./usage.mjs";

// This iPhone's record of AI requests (usage.mjs), in app storage. One per person, so its
// writes go one at a time.
const logs = new Map();
export function usageLog(owner) {
  if (!logs.has(owner)) logs.set(owner, createUsageLog({ storage: AsyncStorage, owner }));
  return logs.get(owner);
}
