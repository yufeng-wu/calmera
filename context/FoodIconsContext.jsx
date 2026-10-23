import { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFoodEmoji } from "@/lib/foodIcons.mjs";
import { createFoodIconPreferences, foodIconById } from "@/lib/foodIconPreferences.mjs";

const preferences = createFoodIconPreferences(AsyncStorage);
const FoodIconsContext = createContext({ emojiFor: entry => getFoodEmoji(entry.foodName ?? entry.food_name), rememberIcons: async () => {} });

export function FoodIconsProvider({ owner, children }) {
  const [state, setState] = useState({ owner, choices: {} });
  const choices = state.owner === owner ? state.choices : {};
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    preferences.load(owner).then(value => { if (active.current && currentOwner.current === owner) setState({ owner, choices: value }); }).catch(() => {});
    return () => { active.current = false; };
  }, [owner]);
  const rememberIcons = async (saved, draft) => {
    const patch = Object.fromEntries(saved.flatMap((entry, index) =>
      entry.id != null && foodIconById(draft[index]?.iconId) ? [[String(entry.id), draft[index].iconId]] : []));
    if (!Object.keys(patch).length) return;
    const value = await preferences.save(owner, patch);
    if (active.current && currentOwner.current === owner) setState({ owner, choices: value });
  };
  const emojiFor = entry => foodIconById(entry.iconId || choices[String(entry.id)])?.emoji
    || getFoodEmoji(entry.foodName ?? entry.food_name);
  return <FoodIconsContext.Provider value={{ emojiFor, rememberIcons }}>{children}</FoodIconsContext.Provider>;
}

export const useFoodIcons = () => useContext(FoodIconsContext);
