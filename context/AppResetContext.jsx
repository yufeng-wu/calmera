import { createContext, useCallback, useContext, useMemo, useState } from "react";

// After Erase all data the app starts over: everything keyed by `epoch` mounts afresh,
// from the privacy agreement on.
const AppResetContext = createContext({ epoch: 0, resetApp: () => {} });

export function AppResetProvider({ children }) {
  const [epoch, setEpoch] = useState(0);
  const resetApp = useCallback(() => setEpoch((value) => value + 1), []);
  const value = useMemo(() => ({ epoch, resetApp }), [epoch, resetApp]);
  return <AppResetContext.Provider value={value}>{children}</AppResetContext.Provider>;
}

export const useAppReset = () => useContext(AppResetContext);
