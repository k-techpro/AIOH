import { BrandLoader } from "@/src/components/Brand";
import React, { useState, useEffect, useRef } from "react";
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
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "@react-native-firebase/auth";
import { useTheme } from "../../src/theme/theme";
import { PrimaryButton } from "../../src/components/ui";

export default function PhoneAuth() {
  const { colors, spacing, radius, isDark } = useTheme();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer]);

  const sendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid mobile number.");
      return;
    }
    
    setLoading(true);
    try {
      // Ensure number is in E.164 format. Assuming India (+91) as default if not provided.
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const confirmation = await signInWithPhoneNumber(getAuth(), formattedPhone);
      setConfirm(confirmation);
      setTimer(60);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (!code || code.length < 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      await confirm?.confirm(code);
    } catch (error: any) {
      Alert.alert("Invalid Code", "The verification code entered is invalid.");
    } finally {
      setLoading(false);
    }
  };

  if (!confirm) {
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
              <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: "600" }}>Mobile Number</Text>
              <Text style={{ color: colors.muted, fontSize: 16, marginTop: 8 }}>Enter your mobile number to receive a verification code.</Text>
            </View>

            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginBottom: 8 }}>Phone Number</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500", marginRight: 8 }}>+91</Text>
                  <View style={{ width: 1, height: 24, backgroundColor: colors.divider, marginRight: 12 }} />
                  <TextInput
                    placeholder="9876543210"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.onSurface }]}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              <PrimaryButton
                label={loading ? "Sending OTP..." : "Get OTP"}
                onPress={sendOtp}
                disabled={loading}
                style={{ marginTop: 16 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <TouchableOpacity onPress={() => setConfirm(null)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          <View style={{ marginBottom: 32 }}>
            <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: "600" }}>Verify OTP</Text>
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 8 }}>
              We&apos;ve sent a 6-digit code to +91 {phone}
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginBottom: 8 }}>Verification Code</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.muted} />
                <TextInput
                  placeholder="123456"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.onSurface, letterSpacing: 8, fontSize: 18, textAlign: "center" }]}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <PrimaryButton
              label={loading ? "Verifying..." : "Verify & Continue"}
              onPress={confirmCode}
              disabled={loading}
              style={{ marginTop: 16 }}
            />

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>Didn&apos;t receive the code?</Text>
              <TouchableOpacity onPress={sendOtp} disabled={timer > 0}>
                <Text style={{ color: timer > 0 ? colors.muted : colors.brand, fontSize: 14, fontWeight: "600" }}>
                  {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
                </Text>
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
