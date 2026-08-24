import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";
import { EmptyState } from "./ui";

export function ComingSoon({ title, subtitle, icon }: { title: string; subtitle: string; icon: any }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>{title}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState icon={icon} title={title} message={subtitle} />
      </View>
    </SafeAreaView>
  );
}
