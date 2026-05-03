import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setBaseUrl, setAuthTokenGetter, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { AuthProvider } from "@/context/AuthContext";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function RootLayoutNav() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
      setTokenReady(true);
    } else {
      setAuthTokenGetter(() => Promise.resolve(null));
      setTokenReady(false);
    }
  }, [isSignedIn, getToken]);

  const { data: meData, isError: meError, isLoading: meLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!isSignedIn && tokenReady,
      retry: false,
    },
  });

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[1] === "onboarding";

    if (!isSignedIn) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in" as any);
      return;
    }

    if (meLoading) return;

    if (meError) {
      if (!inOnboarding) router.replace("/(auth)/onboarding" as any);
      return;
    }

    if (meData && inAuthGroup) {
      router.replace("/(tabs)" as any);
    }
  }, [isLoaded, isSignedIn, meData, meError, meLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: true, title: "Post" }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: "Chat" }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: true, title: "Profile" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <AuthProvider>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </AuthProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
