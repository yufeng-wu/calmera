import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { styles } from "@/assets/styles/auth.styles.js";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors.js";

export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    if (!isLoaded) return;

    // Start the sign-in process using the email and password provided
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      // If sign-in process is complete, set the created session as active
      // and redirect the user
      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        // If the status isn't complete, check why. User might need to
        // complete further steps.
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      const errorCode = err.errors?.[0]?.code;
      if (errorCode === "form_identifier_not_found") {
        // User not registered
        setError("No account found for this email address.");
      } else if (errorCode === "form_password_incorrect") {
        // Wrong password for existing account
        setError("Invalid password. Please try again.");
      } else {
        // Show Clerk error code when we don't have a specific handler
        setError(`Error: ${errorCode || err.message || "Unknown error"}`);
      }
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Image
          source={require("../../assets/images/poster1.png")}
          style={styles.illustration}
        />
        <Text style={styles.title}>Welcome back!</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.expense} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")}>
              <Ionicons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, error && styles.errorInput]}
          autoCapitalize="none"
          value={emailAddress}
          placeholder="Enter email"
          placeholderTextColor={COLORS.textLight}
          onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
        />
        <TextInput
          style={[styles.input, error && styles.errorInput]}
          value={password}
          placeholder="Enter password"
          secureTextEntry={true}
          placeholderTextColor={COLORS.textLight}
          onChangeText={(password) => setPassword(password)}
        />
        {/* Forgot Password Link */}
        <View style={{ alignSelf: "flex-end", marginBottom: 10 }}>
          <Link href="/forgot-password">
            <Text style={styles.linkText}>Forgot password?</Text>
          </Link>
        </View>

        <TouchableOpacity onPress={onSignInPress} style={styles.button}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Link href="/sign-up">
            <Text style={styles.linkText}>Sign up</Text>
          </Link>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
