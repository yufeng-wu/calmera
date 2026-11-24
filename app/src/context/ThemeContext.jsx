import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_THEME_ID, isThemeId, themeForId } from "@/constants/appearance.mjs";
import { useAppReset } from "@/context/AppResetContext";
import { createThemePreferences } from "@/lib/settings/themePreferences.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";

const preferences = createThemePreferences(AsyncStorage);
const ThemeContext = createContext(null);

export function ThemeProvider({ children, review = false }) {
  // Erase all data clears the saved theme, so a reset reads it again.
  const { epoch } = useAppReset();
  const key = review ? "calmera.theme.review.v1" : `calmera.theme.v1:${LOCAL_OWNER}`;
  const [state, setState] = useState({ key: null, id: DEFAULT_THEME_ID, ready: false, saving: false, error: null });
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const write = useRef(0);
  useEffect(() => {
    const ticket = ++generation.current;
    setState({ key, id: DEFAULT_THEME_ID, ready: false, saving: false, error: null });
    if (key) preferences.load(key).then(id => {
      if (generation.current === ticket) setState({ key, id, ready: true, saving: false, error: null });
    }).catch(() => {
      if (generation.current === ticket) setState({ key, id: DEFAULT_THEME_ID, ready: true, saving: false, error: "load" });
    });
    return () => { if (generation.current === ticket) generation.current += 1; };
  }, [key, retry, epoch]);
  const selectTheme = useCallback(async id => {
    if (!key || !isThemeId(id)) throw new Error("invalid_theme");
    const ticket = generation.current;
    const request = ++write.current;
    setState({ key, id, ready: true, saving: true, error: null });
    try {
      await preferences.save(key, id);
      if (generation.current === ticket && write.current === request) {
        setState(previous => ({ ...previous, saving: false }));
      }
    } catch (error) {
      if (generation.current === ticket && write.current === request) {
        setState(previous => ({ ...previous, saving: false, error: "save" }));
      }
      throw error;
    }
  }, [key]);
  const current = state.key === key ? state : { id: DEFAULT_THEME_ID, ready: false, saving: false, error: null };
  const reload = useCallback(() => setRetry(value => value + 1), []);
  const value = useMemo(() => ({ themeId: current.id, theme: themeForId(current.id), ready: current.ready,
    saving: current.saving, error: current.error, selectTheme, reload, review }),
  [current.id, current.ready, current.saving, current.error, selectTheme, reload, review]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is required");
  return value;
}
