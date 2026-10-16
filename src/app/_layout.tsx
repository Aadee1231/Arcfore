import React, { useCallback, useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider } from '@/theme/ThemeProvider';
import { config, isClerkConfigured } from '@/lib/config';
import { registerSupabaseTokenProvider } from '@/lib/supabase';
import { registerApiTokenGetter } from '@/lib/api/client';
import { useActiveRound } from '@/store/activeRound';
import { initSyncEngine } from '@/lib/offline/sync';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function AuthWiring({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const hydrate = useActiveRound((s) => s.hydrate);
  const hydrated = useActiveRound((s) => s.hydrated);

  const getFreshToken = useCallback(async () => {
    try {
      return await getToken({ skipCache: false });
    } catch {
      return null;
    }
  }, [getToken]);

  useEffect(() => {
    registerApiTokenGetter(getFreshToken);
    registerSupabaseTokenProvider(getFreshToken);
    initSyncEngine();
    void hydrate();
  }, [getFreshToken, hydrate]);

  const segments = useSegments();
  const router = useRouter();
  const navReady = useRef(false);

  useEffect(() => {
    if (!isLoaded || !hydrated || !navReady.current) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    if (!isSignedIn && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && (inAuth || !segments[0])) {
      router.replace('/(tabs)');
    } else if (isSignedIn && inOnboarding) {
      // onboarding screen manages its own exit
    }
  }, [isLoaded, isSignedIn, hydrated, segments, router]);

  useEffect(() => {
    navReady.current = true;
  }, []);

  return <>{children}</>;
}

function Inner() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const hydrated = useActiveRound((s) => s.hydrated);

  useEffect(() => {
    if (fontsLoaded && hydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded) return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="course/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="round/setup" options={{ presentation: 'card' }} />
        <Stack.Screen name="round/active" options={{ gestureEnabled: false }} />
        <Stack.Screen name="round/[id]/scorecard" />
        <Stack.Screen name="round/[id]/summary" />
        <Stack.Screen name="round/join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="coach/record" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="coach/analysis/[id]" />
        <Stack.Screen name="coach/chat" />
        <Stack.Screen name="bag/index" />
        <Stack.Screen name="practice/index" />
        <Stack.Screen name="practice/[slug]" />
        <Stack.Screen name="share/round/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const publishableKey = config.clerkPublishableKey;

  const tree = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <Inner />
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  // Clerk missing → run in signed-out/dev-preview mode (auth screens explain setup)
  if (!isClerkConfigured() || !publishableKey) {
    return tree;
  }
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthWiring>{tree}</AuthWiring>
    </ClerkProvider>
  );
}
