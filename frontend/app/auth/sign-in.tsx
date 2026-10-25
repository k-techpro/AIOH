import { BrandMark } from "@/src/components/Brand";
import { BrandLoader } from "@/src/components/Brand";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useTheme } from "../../src/theme/theme";
import { PrimaryButton } from "../../src/components/ui";

export default function SignIn() {
  const { colors, spacing, radius, isDark } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getAuth(), email, password);
      // Auth state listener in _layout.tsx will handle redirection
    } catch (error: any) {
      let message = "An error occurred during sign in.";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        message = "Invalid email or password.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      }
      Alert.alert("Sign In Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error("Google did not return an ID token. Check the Web OAuth client and Android SHA-1 configuration.");
      const googleCredential = GoogleAuthProvider.credential(data.idToken);
      await signInWithCredential(getAuth(), googleCredential);
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code === "SIGN_IN_CANCELLED" || code === "12501") return;
      const configurationError = code === "DEVELOPER_ERROR" || code === "10" || code === "12500";
      const message = configurationError
        ? "Google Sign-In configuration is incomplete. Confirm this APK's signing SHA-1 and the Web OAuth client in Firebase."
        : error?.message || "Google Sign-In failed. Please try again.";
      Alert.alert("Google Sign In Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Email Required", "Please enter your email address to reset your password.");
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), email);
      Alert.alert("Success", "Password reset email sent!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <BrandMark size={44} />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: "600" }}>RetailPrime</Text>
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 8 }}>Welcome back! Please sign in.</Text>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginBottom: 8 }}>Email Address</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={colors.muted} />
                <TextInput
                  placeholder="name@company.com"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.onSurface }]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginBottom: 8 }}>Password</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.onSurface }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: "flex-end", marginTop: 8 }}>
                <Text style={{ color: colors.info, fontSize: 13, fontWeight: "500" }}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <PrimaryButton
              label={loading ? "Signing in..." : "Sign In"}
              onPress={handleSignIn}
              disabled={loading}
              style={{ marginTop: 8 }}
            />

            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
              <Text style={{ color: colors.muted, marginHorizontal: 16, fontSize: 13 }}>or continue with</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            </View>

            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={loading}
              style={[styles.socialButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Ionicons name="logo-google" size={20} color={colors.onSurface} />
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/auth/phone")}
              disabled={loading}
              style={[styles.socialButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Ionicons name="call-outline" size={20} color={colors.onSurface} />
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>Continue with Mobile Number</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>Don&apos;t have an account?</Text>
              <TouchableOpacity onPress={() => router.push("/auth/sign-up")}>
                <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "600" }}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
});
