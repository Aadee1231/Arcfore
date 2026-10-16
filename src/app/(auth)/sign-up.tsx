import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSignUp } from '@clerk/expo';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/theme';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignUp() {
  const colors = useColors();
  const router = useRouter();
  const { signUp } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clerkError = (e: unknown) =>
    (e as { errors?: { longMessage?: string }[] })?.errors?.[0]?.longMessage ??
    'Something went wrong — try again.';

  const onSignUp = async () => {
    if (!signUp) return;
    setBusy(true);
    setError(null);
    try {
      const { error: createError } = await signUp.password({
        emailAddress: email.trim(),
        password,
        firstName: name.trim() || undefined,
      });
      if (createError) {
        setError(createError.longMessage ?? 'Could not create your account.');
        return;
      }
      if (signUp.status === 'missing_requirements') {
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) {
          setError(sendError.longMessage ?? 'Could not send the verification code.');
          return;
        }
        setPendingVerification(true);
      } else if (signUp.status === 'complete') {
        await signUp.finalize();
        router.replace('/(onboarding)');
      } else {
        setPendingVerification(true);
      }
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!signUp) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (verifyError) {
        setError(verifyError.longMessage ?? 'That code did not work — try again.');
        return;
      }
      if (signUp.status === 'complete') {
        await signUp.finalize();
        router.replace('/(onboarding)');
      } else {
        setError('Verification incomplete — try again.');
      }
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={[styles.wordmark, { color: colors.forest }]}>Arcfore</Text>
            <Text variant="body" secondary>
              {pendingVerification ? 'Check your inbox' : 'Create your account'}
            </Text>
          </View>

          {!pendingVerification ? (
            <View style={styles.form}>
              <Input label="Name" value={name} onChangeText={setName} placeholder="Aadee" autoComplete="name" />
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
                placeholder="8+ characters"
                autoComplete="new-password"
              />
              {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
              <Button
                title="Create account"
                size="lg"
                fullWidth
                loading={busy}
                disabled={!email || password.length < 8}
                onPress={onSignUp}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text variant="body" secondary>
                We sent a 6-digit code to {email}. Enter it below to finish.
              </Text>
              <Input
                label="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
                autoComplete="one-time-code"
              />
              {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
              <Button
                title="Verify email"
                size="lg"
                fullWidth
                loading={busy}
                disabled={code.length < 6}
                onPress={onVerify}
              />
            </View>
          )}

          <View style={styles.footer}>
            <Text variant="body" secondary>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Text variant="bodyStrong" style={{ color: colors.forest }}>
                Sign in
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
  wordmark: { fontFamily: fonts.serifBold, fontSize: 52, letterSpacing: -0.5 },
  form: { gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
