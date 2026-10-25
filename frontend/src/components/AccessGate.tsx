import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";
import { useBusiness } from "../services/business";
import { useAuthStore } from "../services/auth";

/** Shown after sign-in until the server has issued the secure access session (web parity). */
export default function AccessGate() {
  const { colors } = useTheme();
  const { status, error, bootstrap, submitPassword } = useBusiness();
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState("");
  const checking = status === "checking" || status === "idle";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center", padding: 28 }}>
      <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", textAlign: "center" }}>
        {status === "needs_password" ? "Secure Business Access" : status === "deactivated" ? "Account deactivated" : "Verifying your access"}
      </Text>
      {checking && <ActivityIndicator style={{ marginTop: 24 }} color={colors.brand} />}
      {status === "needs_password" && (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Enter the access password to open RetailPrime.</Text>
          <TextInput
            testID="access-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Access password"
            placeholderTextColor={colors.muted}
            onSubmitEditing={() => password && submitPassword(password)}
            style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 16 }}
          />
          <Pressable testID="access-submit" disabled={!password} onPress={() => submitPassword(password)} style={{ backgroundColor: colors.brand, padding: 14, borderRadius: 12, opacity: password ? 1 : 0.5 }}>
            <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", textAlign: "center" }}>Continue</Text>
          </Pressable>
        </View>
      )}
      {!!error && <Text testID="access-error" style={{ color: colors.error, textAlign: "center", marginTop: 16 }}>{error}</Text>}
      {(status === "error" || status === "deactivated") && (
        <View style={{ marginTop: 20, gap: 10 }}>
          {status === "error" && (
            <Pressable onPress={() => bootstrap()} style={{ backgroundColor: colors.brand, padding: 14, borderRadius: 12 }}>
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", textAlign: "center" }}>Retry</Text>
            </Pressable>
          )}
        </View>
      )}
      {status !== "checking" && (
        <Pressable onPress={() => logout()} style={{ marginTop: 18, padding: 10 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Sign out</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
