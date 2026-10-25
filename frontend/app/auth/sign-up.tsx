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
  createUserWithEmailAndPassword,
  getAuth,
  updateProfile,
} from "@react-native-firebase/auth";
import { useTheme } from "../../src/theme/theme";
import { PrimaryButton } from "../../src/components/ui";

export default function SignUp() {
  const { colors, spacing, radius, isDark } = useTheme();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (error: any) {
      let message = "An error occurred during sign up.";
      if (error.code === "auth/email-already-in-use") {
        message = "This email address is already in use.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/weak-password") {
        message = "The password is too weak. Please use at least 6 characters.";
      }
      Alert.alert("Registration Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          <View style={{ marginBottom: 32 }}>
            <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: "600" }}>Create Account</Text>
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 8 }}>Join RetailPrime to manage your shops efficiently.</Text>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginBottom: 8 }}>Full Name</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={20} color={colors.muted} />
                <TextInput
                  placeholder="John Doe"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.onSurface }]}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

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
            </View>

            <PrimaryButton
              label={loading ? "Creating Account..." : "Create Account"}
              onPress={handleSignUp}
              disabled={loading}
              style={{ marginTop: 16 }}
            />

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "600" }}>Sign In</Text>
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
});
