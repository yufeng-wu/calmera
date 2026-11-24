import { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFoodIcon } from "@/lib/foodIcons.mjs";
import { createFoodIconPreferences, foodIconById } from "@/lib/foodIconPreferences.mjs";

const preferences = createFoodIconPreferences(AsyncStorage);
const FoodIconsContext = createContext({ iconFor: entry => getFoodIcon(entry.foodName ?? entry.food_name), rememberIcons: async () => {} });

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
  // A chosen icon (in the draft or saved for this record) wins over name matching. A food
  // that stands for many meals (entryIds, oldest first) uses the latest one's chosen icon.
  const chosenAmong = ids => [...(ids || [])].reverse().map(id => choices[String(id)]).find(Boolean);
  const iconFor = entry => foodIconById(entry.iconId || choices[String(entry.id)] || chosenAmong(entry.entryIds))
    || getFoodIcon(entry.foodName ?? entry.food_name);
  return <FoodIconsContext.Provider value={{ iconFor, rememberIcons }}>{children}</FoodIconsContext.Provider>;
}

export const useFoodIcons = () => useContext(FoodIconsContext);
