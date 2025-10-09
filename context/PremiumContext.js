import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "@clerk/clerk-expo";
import { USERS_API_URL } from "@/constants/api";

const PremiumContext = createContext({
  isPremium: false,
  plan: null,
  premiumExpiresAt: null,
});

export const usePremium = () => useContext(PremiumContext);

export function PremiumProvider({ children }) {
  const { getToken, isLoaded } = useAuth();
  const [state, setState] = useState({
    isPremium: false,
    plan: null,
    premiumExpiresAt: null,
  });

  const fetchStatus = useCallback(async () => {
    if (!isLoaded) return;
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${USERS_API_URL}/get-user`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setState({
        isPremium: data.isPremium,
        plan: data.plan,
        premiumExpiresAt: data.premiumExpiresAt,
      });
      console.log(
        "[Premium] isPremium:",
        data.isPremium,
        "plan:",
        data.plan,
        "expires:",
        data.premiumExpiresAt
      );
    } catch (e) {
      console.warn("premium status fetch failed", e);
    }
  }, [getToken, isLoaded]);

  // Fetch once when Clerk session ready and whenever refreshPremium is explicitly called
  useEffect(() => {
    if (isLoaded) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  return (
    <PremiumContext.Provider value={{ ...state, refreshPremium: fetchStatus }}>
      {children}
    </PremiumContext.Provider>
  );
}
