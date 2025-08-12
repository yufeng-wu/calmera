import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { styles } from "@/assets/styles/auth.styles.js";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors.js";

export default function ForgotPassword() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stage, setStage] = useState("REQUEST"); // REQUEST -> VERIFY -> RESET
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSendCode = async () => {
    if (!isLoaded) return;
    setError("");
    try {
      await signIn.create({
        identifier: emailAddress,
        strategy: "reset_password_email_code",
      });
      Keyboard.dismiss();
      setStage("VERIFY");
      setInfo("We've sent a verification code to your email. Enter it below.");
    } catch (err) {
      console.error(err);
      setError(
        "Unable to send reset code. Please check the email address and try again."
      );
    }
  };

  const handleVerifyCode = async () => {
    if (!isLoaded) return;
    setError("");
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });
      if (attempt.status === "needs_new_password") {
        Keyboard.dismiss();
        setStage("RESET");
        setInfo("Code verified! Please enter your new password.");
      } else {
        setError("Unexpected verification status. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Invalid code. Please try again.");
    }
  };

  const handleResetPassword = async () => {
    if (!isLoaded) return;
    setError("");
    try {
      const result = await signIn.resetPassword({ password: newPassword });
      if (result.status === "complete") {
        // Automatically activate the new session and navigate to the app
        await setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        setError(
          "Unexpected status while setting new password. Please try again."
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        "Failed to reset password. Please ensure the password meets requirements."
      );
    }
  };

  const renderContent = () => {
    switch (stage) {
      case "REQUEST":
        return (
          <>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Enter email"
              placeholderTextColor={COLORS.textLight}
              onChangeText={setEmailAddress}
            />
            <TouchableOpacity onPress={handleSendCode} style={styles.button}>
              <Text style={styles.buttonText}>Send Reset Code</Text>
            </TouchableOpacity>
          </>
        );
      case "VERIFY":
        return (
          <>
            <TextInput
              style={styles.verificationInput}
              value={code}
              placeholder="6-digit code"
              placeholderTextColor={COLORS.textLight}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={handleVerifyCode} style={styles.button}>
              <Text style={styles.buttonText}>Verify Code</Text>
            </TouchableOpacity>
          </>
        );
      case "RESET":
        return (
          <>
            <TextInput
              style={styles.input}
              value={newPassword}
              placeholder="New password"
              secureTextEntry
              keyboardType="default"
              placeholderTextColor={COLORS.textLight}
              onChangeText={setNewPassword}
            />
            <Text
              style={{
                fontSize: 12,
                color: COLORS.textLight,
                marginTop: 4,
                marginBottom: 8,
                alignSelf: "flex-start",
              }}
            >
              Password must be at least 8 characters long.
            </Text>
            <TouchableOpacity
              onPress={handleResetPassword}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Reset Password</Text>
            </TouchableOpacity>
          </>
        );
      default:
        return null;
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
        <Text style={styles.title}>Reset Password</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.expense} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")}>
              <Ionicons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}

        {info ? (
          <Text
            style={{
              color: COLORS.text,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            {info}
          </Text>
        ) : null}

        {renderContent()}

        {
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Remembered your password?</Text>
            <Link href="/sign-in" replace>
              <Text style={styles.linkText}>Sign in</Text>
            </Link>
          </View>
        }
      </View>
    </KeyboardAwareScrollView>
  );
}
