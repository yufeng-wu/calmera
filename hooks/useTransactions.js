// react custom hook file

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "@/constants/api";

export const useTransactions = (userId) => {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    balance: 0,
    income: 0,
    expense: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  // useCallback is used for performance optimization, it will only re-run if the userId changes
  // Question: when user adds a new transaction, how does the hook know to update the transactions?
  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/${userId}`);
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  }, [userId]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/summary/${userId}`);
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  }, [userId]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // can be done in parallel
      await Promise.all([fetchTransactions(), fetchSummary()]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTransactions, fetchSummary, userId]);

  const deleteTransaction = async (id) => {
    console.log("deleting transaction", id);
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete transaction");

      // refresh after deletion
      loadData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      Alert.alert("Error", error.message);
    }
  };

  return {
    transactions,
    summary,
    isLoading,
    loadData,
    deleteTransaction,
  };
};
