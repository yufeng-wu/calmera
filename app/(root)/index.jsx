import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import { Text, TouchableOpacity, View } from "react-native";
import { SignOutButton } from "@/components/SignOutButton";
import { useEffect } from "react";
import { useTransactions } from "../../hooks/useTransactions";
import PageLoader from "@/components/PageLoader";
import { styles } from "@/assets/styles/home.styles";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BalanceCard } from "@/components/BalanceCard";
import { FlatList, RefreshControl } from "react-native";
import { TransactionItem } from "@/components/TransactionItem";
import { Alert } from "react-native";
import NoRecordYet from "@/components/NoRecordYet";
import { useState } from "react";

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // user.id comes from Clerk
  const { transactions, summary, isLoading, loadData, deleteTransaction } =
    useTransactions(user.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteTransaction(id),
        },
      ]
    );
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !refreshing) {
    return <PageLoader />;
  }

  console.log("transactions", summary);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* LEFT */}
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.usernameText}>
                {user?.emailAddresses[0].emailAddress}
              </Text>
            </View>
          </View>

          {/* RIGHT */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/create")}
            >
              <Ionicons name="add" size={16} color="white" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
            <SignOutButton />
          </View>
        </View>

        <BalanceCard summary={summary} />
      </View>

      {/* TRANSACTIONS LIST */}
      <View style={styles.transactionsHeaderContainer}>
        <Text style={styles.transactionTitle}>Recent Transactions</Text>
      </View>

      {/* TRANSACTIONS LIST */}
      {/* Flatlist renders the list lazily only for those on the screen*/}
      <FlatList
        style={styles.transactionsList}
        contentContainerStyle={styles.transactionsListContent}
        data={transactions}
        renderItem={({ item: transaction }) => (
          <TransactionItem item={transaction} onDelete={handleDelete} />
        )}
        ListEmptyComponent={<NoRecordYet />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}
