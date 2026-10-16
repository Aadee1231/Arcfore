import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSignIn, useSSO } from '@clerk/expo';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/theme/ThemeProvider';
import { fonts, spacing, type } from '@/theme/theme';
import { isClerkConfigured } from '@/lib/config';
import { useWarmUpBrowser } from '@/lib/auth/useWarmUpBrowser';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';

export default function SignIn() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, errors: clerkErrors } = useSignIn();
  const { startSSOFlow } = useSSO();
  useWarmUpBrowser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  const fieldError = useCallback(
    () =>
      clerkErrors.fields.identifier?.longMessage ??
      clerkErrors.fields.password?.longMessage ??
      clerkErrors.fields.code?.longMessage,
    [clerkErrors],
  );

  const onEmailSignIn = async () => {
    if (!signIn) return;
    setBusy('email');
    setError(null);
    try {
      const { error: createError } = await signIn.create({ identifier: email.trim() });
      if (createError) {
        setError(createError.longMessage ?? 'Could not sign in — check your details.');
        return;
      }
      const { error: pwError } = await signIn.password({ password });
      if (pwError) {
        setError(pwError.longMessage ?? 'Incorrect password — try again.');
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize();
        router.replace('/(tabs)');
      } else if (signIn.status === 'needs_second_factor') {
        setError('Two-factor sign-in is not supported yet — disable 2FA or use a social sign-in.');
      } else {
        setError('Additional verification is required. Check your email or try again.');
      }
    } catch {
      setError(fieldError() ?? 'Could not sign in — check your details.');
    } finally {
      setBusy(null);
    }
  };

  const onSSO = async (strategy: 'oauth_google' | 'oauth_apple', which: 'google' | 'apple') => {
    setBusy(which);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/(tabs)', { scheme: 'arcfore' }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (e) {
      const msg =
        (e as { errors?: { longMessage?: string }[] })?.errors?.[0]?.longMessage ??
        'Sign-in was cancelled or failed.';
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={[styles.wordmark, { color: colors.forest }]}>Arcfore</Text>
            <Text variant="body" secondary style={styles.tagline}>
              Your game. Understood.
            </Text>
          </View>

          {!isClerkConfigured() ? (
            <View style={[styles.notice, { backgroundColor: colors.sage }]}>
              <Text variant="label">Auth not configured</Text>
              <Text variant="caption" secondary>
                Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env to enable sign-in.
              </Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Button
              title="Continue with Google"
              variant="outline"
              size="lg"
              fullWidth
              loading={busy === 'google'}
              onPress={() => onSSO('oauth_google', 'google')}
            />
            <Button
              title="Continue with Apple"
              variant="outline"
              size="lg"
              fullWidth
              loading={busy === 'apple'}
              onPress={() => onSSO('oauth_apple', 'apple')}
            />
            <Divider label="or with email" />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              autoComplete="password"
            />
            {error ? (
              <Text variant="caption" style={{ color: colors.danger }}>
                {error}
              </Text>
            ) : null}
            <Button
              title="Sign in"
              size="lg"
              fullWidth
              loading={busy === 'email'}
              disabled={!email || !password}
              onPress={onEmailSignIn}
            />
          </View>

          <View style={styles.footer}>
            <Text variant="body" secondary>
              New to Arcfore?{' '}
            </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Text variant="bodyStrong" style={{ color: colors.forest }}>
                Create account
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  brand: { alignItems: 'center', gap: spacing.xs },
  wordmark: {
    fontFamily: fonts.serifBold,
    fontSize: 52,
    letterSpacing: -0.5,
  },
  tagline: { ...type.body },
  notice: { padding: spacing.md, borderRadius: 12, gap: 2 },
  form: { gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
