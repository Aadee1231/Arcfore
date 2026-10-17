import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { registerApiTokenGetter } from '@/lib/api/client';
import { AuthContext, ClerkAuthBridge, LOCAL_AUTH, useAuthUser } from '@/lib/auth';
import { config, isClerkConfigured } from '@/lib/config';
import { initDb } from '@/lib/db/database';
import { getProfile } from '@/lib/db/repo';
import { initPersistence } from '@/lib/offline/sync';
import { useActiveRound } from '@/store/activeRound';
import { AppThemeProvider } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function AuthWiring({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuthUser();
  const hydrate = useActiveRound((s) => s.hydrate);
  const hydrated = useActiveRound((s) => s.hydrated);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  const getFreshToken = useCallback(async () => {
    try {
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken]);

  useEffect(() => {
    registerApiTokenGetter(getFreshToken);
    initPersistence();
    // Local DB is the source of truth — open + migrate before hydrating.
    void initDb()
      .then(async () => {
        await hydrate();
        const profile = await getProfile().catch(() => null);
        setNeedsOnboarding(profile == null);
      })
      .catch((e) => {
        console.warn('Arcfore: DB init failed, retrying once:', e);
        // One retry — a corrupt or busy DB should still let the app boot.
        return initDb()
          .then(async () => {
            await hydrate();
            setNeedsOnboarding((await getProfile().catch(() => null)) == null);
          })
          .catch(() => setNeedsOnboarding(false));
      });
  }, [getFreshToken, hydrate]);

  const segments = useSegments();
  const router = useRouter();
  const navReady = useRef(false);

  useEffect(() => {
    if (!hydrated || needsOnboarding == null || !navReady.current) return;
    const inOnboarding = segments[0] === '(onboarding)';
    const atRoot = !segments[0];
    // Everything works without an account — only local-profile setup is gated,
    // and only at cold start (the onboarding flow routes itself to tabs).
    if (needsOnboarding && !inOnboarding && atRoot) {
      router.replace('/(onboarding)');
    } else if (!needsOnboarding && atRoot) {
      router.replace('/(tabs)');
    }
  }, [hydrated, needsOnboarding, segments, router]);

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
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="course/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="round/setup" options={{ presentation: 'card' }} />
        <Stack.Screen name="round/active" options={{ gestureEnabled: false }} />
        <Stack.Screen name="round/scorecard" />
        <Stack.Screen name="round/[id]/summary" />
        <Stack.Screen name="round/[id]/share" options={{ presentation: 'modal' }} />
        <Stack.Screen name="coach/record" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="coach/analysis/[id]" />
        <Stack.Screen name="coach/chat" />
        <Stack.Screen name="bag/index" />
        <Stack.Screen name="practice" />
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

  // Local-first: no sign-in required. Clerk is optional — when configured the
  // provider is mounted so users CAN sign in (sync/backup later), but nothing
  // is gated on it.
  if (!isClerkConfigured() || !publishableKey) {
    return (
      <AuthContext.Provider value={LOCAL_AUTH}>
        <AuthWiring>{tree}</AuthWiring>
      </AuthContext.Provider>
    );
  }
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkAuthBridge>
        <AuthWiring>{tree}</AuthWiring>
      </ClerkAuthBridge>
    </ClerkProvider>
  );
}
