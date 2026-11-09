import test from "node:test";
import assert from "node:assert/strict";
import { chatGPTKeys, eraseThisPhone, formerOwners, ownsKey, secureKeysFor, SHARED_SECURE_KEYS } from "../lib/eraseData.mjs";
import { consentStorageKey } from "../lib/privacyConsent.mjs";
import { createPhoneStore } from "../lib/store/phone.mjs";
import { createMemoryStorage } from "../lib/store/memoryStorage.mjs";

// Erase all data: everything calmera keeps on this iPhone goes, and nothing else does.
function fakeKeychain(keys = [], failing = []) {
  const map = new Map(keys.map((key) => [key, "secret"]));
  return { map, deleteItemAsync: async (key) => { if (failing.includes(key)) throw new Error("keychain"); map.delete(key); } };
}

test("a person's keys are recognised exactly", () => {
  const me = "local";
  for (const key of [`calmera.food-icons.v1.${me}`, `calmera.meal-times.${me}`, `calmera.theme.v1:${me}`,
    consentStorageKey(me), `calmera.chatgpt.${me}.model`]) assert.equal(ownsKey(key, me), true, key);
  for (const key of [`calmera.theme.v1:${me}x`, `calmera.meal-times.loc`, `other.theme.v1:${me}`, null]) assert.equal(ownsKey(key, me), false, String(key));
  assert.equal(ownsKey(`calmera.theme.v1:${me}`, ""), false);
  assert.ok(chatGPTKeys(me).every((key) => ownsKey(key, me)));
  assert.equal(new Set(secureKeysFor(me)).size, 6);
});

test("people who signed in to the cloud version are found from the keys they left", () => {
  assert.deepEqual(formerOwners([
    "calmera.theme.v1:user_2abc", "calmera.privacy-consent.user_2abc", "calmera.today.v1.user_9xyz",
    "calmera.account-ready.v1.user_9xyz", "calmera.theme.v1:guest", "calmera.theme.v1:local", "calmera.data.v1.meta", "unrelated",
  ]).sort(), ["user_2abc", "user_9xyz"]);
});

test("erasing removes every calmera key and the Keychain items it knows, and nothing else", async () => {
  const appStorage = createMemoryStorage({
    "calmera.data.v1.day.2026-11-08": "[]", "calmera.theme.v1:local": "dusk", [consentStorageKey("local")]: "{}",
    "calmera.meal-times.local": "{}", "calmera.today.v1.user_old": "{}", "calmera.theme.v1:user_old": "dawn",
    "calmera.theme.review.v1": "grove", "unrelated": "x",
  });
  const keychain = fakeKeychain([...secureKeysFor("local"), ...secureKeysFor("user_old"), ...SHARED_SECURE_KEYS, "someone.else"]);
  let disconnected = 0;
  const failures = await eraseThisPhone({ asyncStorage: appStorage, secureStore: keychain, disconnectChatGPT: async () => { disconnected++; } });
  assert.deepEqual(failures, []);
  assert.equal(disconnected, 1);
  assert.deepEqual([...appStorage.data.keys()], ["unrelated"]);
  assert.deepEqual([...keychain.map.keys()], ["someone.else"]);
});

test("ChatGPT credentials are deleted even when revoking them with OpenAI fails or stalls", async () => {
  for (const disconnectChatGPT of [async () => { throw new Error("offline"); }, () => new Promise(() => {}), () => { throw new Error("sync"); }]) {
    const keychain = fakeKeychain(secureKeysFor("local"));
    const failures = await eraseThisPhone({ asyncStorage: createMemoryStorage(), secureStore: keychain, disconnectChatGPT, revokeTimeoutMs: 20 });
    assert.deepEqual(failures, []);
    assert.equal(keychain.map.size, 0);
  }
});

test("anything that couldn't be removed is reported, so erasing can be tried again", async () => {
  const keychain = fakeKeychain(secureKeysFor("local"), ["calmera.voice.local"]);
  const failures = await eraseThisPhone({ asyncStorage: createMemoryStorage({ "calmera.theme.v1:local": "dusk" }, { failWrites: true }), secureStore: keychain });
  assert.deepEqual(failures, ["calmera.voice.local", "app-storage"]);
  assert.equal(keychain.map.size, 1);
  const retried = await eraseThisPhone({ asyncStorage: createMemoryStorage(), secureStore: fakeKeychain(["calmera.voice.local"]) });
  assert.deepEqual(retried, []);
});

test("an export file left in the cache folder is removed, and other cached files stay", async () => {
  const files = new Map([["calmera-data-2026-11-08.json", "{}"], ["calmera-data-2026-11-01.json", "{}"], ["com.hackemist.SDImageCache", "dir"]]);
  const cacheFiles = {
    list: async () => [...files.keys()].map((name) => ({ name, path: `/caches/${name}` })),
    remove: async (path) => { if (path.endsWith("11-01.json")) throw new Error("busy"); files.delete(path.slice("/caches/".length)); },
  };
  const failures = await eraseThisPhone({ asyncStorage: createMemoryStorage(), secureStore: fakeKeychain(), cacheFiles });
  assert.deepEqual(failures, ["calmera-data-2026-11-01.json"]);
  assert.deepEqual([...files.keys()], ["calmera-data-2026-11-01.json", "com.hackemist.SDImageCache"]);
  const unreadable = await eraseThisPhone({ asyncStorage: createMemoryStorage(), secureStore: fakeKeychain(),
    cacheFiles: { list: async () => { throw new Error("denied"); }, remove: async () => {} } });
  assert.deepEqual(unreadable, ["cache-files"]);
});

test("after erasing, calmera starts over: no meals, default goals, and a new start date", async () => {
  const storage = createMemoryStorage();
  const data = createPhoneStore({ storage, now: () => new Date("2026-11-01T09:00:00-04:00").getTime() });
  await data.createMeals([{ foodName: "Synthetic oats", quantity: "1 bowl", mealType: "Breakfast", calories: 300, protein: 10, carbs: 50, fat: 6 }],
    { createdAt: "2026-11-01T08:00:00-04:00" });
  await data.saveGoals({ calorieGoal: 1700 }, { startDate: "2026-11-01" });
  storage.data.set(consentStorageKey("local"), "{}");
  await data.eraseAll();
  await eraseThisPhone({ asyncStorage: storage, secureStore: fakeKeychain() });
  assert.deepEqual([...storage.data.keys()], []);
  const reopened = createPhoneStore({ storage, now: () => new Date("2026-11-09T09:00:00-05:00").getTime() });
  assert.deepEqual(await reopened.readDays(), {});
  assert.deepEqual(await reopened.readProfile(), { createdAtLocalDate: "2026-11-09", calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 });
});
