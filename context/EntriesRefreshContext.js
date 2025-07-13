// React context to signal when the food-entries list and goals should be refreshed across screens.
import React, { createContext, useContext, useState } from "react";

// The context holds boolean flags and their setters for both entries and goals.
const EntriesRefreshContext = createContext({
  shouldRefresh: false,
  shouldRefreshGoals: false,
  // eslint-disable-next-line no-empty-function
  setShouldRefresh: () => {},
  // eslint-disable-next-line no-empty-function
  setShouldRefreshGoals: () => {},
});

export const EntriesRefreshProvider = ({ children }) => {
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [shouldRefreshGoals, setShouldRefreshGoals] = useState(false);
  return (
    <EntriesRefreshContext.Provider
      value={{
        shouldRefresh,
        setShouldRefresh,
        shouldRefreshGoals,
        setShouldRefreshGoals,
      }}
    >
      {children}
    </EntriesRefreshContext.Provider>
  );
};

export const useRefreshSignal = () => useContext(EntriesRefreshContext);
