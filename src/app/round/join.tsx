import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthUser } from '@/lib/auth';
import { Users } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { fetchRoundByShareCode } from '@/lib/offline/sync';
import { useActiveRound } from '@/store/activeRound';
import { isSupabaseConfigured } from '@/lib/config';

/** Join a live multi-device round via its 6-character share code. */
export default function JoinRoundScreen() {
  const colors = useColors();
  const router = useRouter();
  useAuthUser();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const adoptRound = useActiveRound((s) => s.adoptRound);
  const active = useActiveRound((s) => s.round);

  const join = async () => {
    setError(null);
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError('Share codes are 6 characters.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Multiplayer needs Supabase configured (see .env.example).');
      return;
    }
    setBusy(true);
    try {
      const round = await fetchRoundByShareCode(clean);
      if (!round) {
        setError('No live round found with that code. Check the spelling.');
        return;
      }
      if (round.status !== 'active') {
        setError('That round has already finished.');
        return;
      }
      if (active?.status === 'active' && active.id !== round.id) {
        setError('Finish or abandon your current round first.');
        return;
      }
      adoptRound(round);
      router.replace('/round/active');
    } catch {
      setError('Could not reach the server — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll padded={false}>
      <Stack.Screen options={{ title: 'Join a round', headerBackTitle: 'Back' }} />
      <View style={styles.body}>
        <Users size={32} color={colors.brass} />
        <Text variant="title" style={{ color: colors.forest }}>
          Got a share code?
        </Text>
        <Text variant="body" secondary>
          A friend starts a "Shared live round" and reads you the 6-character code. Enter it here and you'll
          score together in real time.
        </Text>
        <Input
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="ABC123"
          autoCapitalize="characters"
          maxLength={6}
          style={styles.codeInput}
        />
        {error ? (
          <Text variant="caption" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}
        <Button title="Join round" size="lg" fullWidth loading={busy} disabled={code.length !== 6} onPress={join} />
        <Card>
          <Text variant="caption" secondary>
            Anyone in the round can see every player's scores. Only round members can join.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  codeInput: { letterSpacing: 6 },
});
