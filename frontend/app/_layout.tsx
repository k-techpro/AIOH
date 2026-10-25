import { BrandLoader } from "@/src/components/Brand";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, Text, Pressable } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAuthStore, subscribeToAuthChanges } from "@/src/services/auth";
import { ThemeProvider, useTheme } from "@/src/theme/theme";
import { useBusiness } from "@/src/services/business";
import AccessGate from "@/src/components/AccessGate";


// Keep known development-only style warnings from obscuring genuine runtime
// failures. Production errors must remain visible to the user and telemetry.
LogBox.ignoreLogs(["Require cycle:"]);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, initialized, loading, error } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();
  const gateStatus = useBusiness((s) => s.status);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "auth";

    if (!user && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace("/auth/sign-in");
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace("/");
    }
  }, [user, initialized, segments, router]);

  if (!initialized || (loading && !user)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <BrandLoader size="large" color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, padding: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700", textAlign: "center" }}>Firebase needs attention</Text>
        <Text style={{ color: colors.muted, marginTop: 12, textAlign: "center", lineHeight: 21 }}>{error}</Text>
        <Pressable onPress={() => subscribeToAuthChanges()} style={{ marginTop: 20, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.brand }}>
          <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Signed in but the server has not issued the access session / business context yet.
  if (user && gateStatus !== "ready" && segments[0] !== "auth") return <AccessGate />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/sign-in" options={{ animation: "fade" }} />
      <Stack.Screen name="auth/sign-up" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="auth/phone" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="coupon-management" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="firebase" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="reports" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="search" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="services" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="staff" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="returns" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="invoice-history" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="expenses" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="finance" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="pay-later" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="shops" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="walk-in" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="payments" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="history" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="notes" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="attendance" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="stock" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useIconFonts();

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const subscribeWhenReady = () => {
      if (cancelled) return;
      unsubscribe = subscribeToAuthChanges();
      if (!unsubscribe) {
        // Expo Go does not contain this app's native Firebase configuration.
        // Surface that clearly instead of allowing a fake/local sign-in.
        useAuthStore.getState().setError("Firebase is unavailable in this client. Install a native Android build of RetailPrime to sign in.");
        useAuthStore.getState().setLoading(false);
        useAuthStore.getState().setInitialized(true);
      }
    };

    subscribeWhenReady();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutNav />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

