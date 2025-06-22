// React context to signal when the food-entries list should be refreshed across screens.
import React, { createContext, useContext, useState } from "react";

// The context holds a boolean flag and its setter.
const EntriesRefreshContext = createContext({
  shouldRefresh: false,
  // eslint-disable-next-line no-empty-function
  setShouldRefresh: () => {},
});

export const EntriesRefreshProvider = ({ children }) => {
  const [shouldRefresh, setShouldRefresh] = useState(false);
  return (
    <EntriesRefreshContext.Provider value={{ shouldRefresh, setShouldRefresh }}>
      {children}
    </EntriesRefreshContext.Provider>
  );
};

export const useRefreshSignal = () => useContext(EntriesRefreshContext);
