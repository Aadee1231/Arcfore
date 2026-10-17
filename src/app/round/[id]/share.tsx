import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchLocalRound } from '@/lib/offline/sync';
import { formatToPar, participantStats, } from '@/lib/scoring/engine';
import { useActiveRound } from '@/store/activeRound';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, radius, spacing, } from '@/theme/theme';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react-native';

/** Editorial share card — looks like a printed scorecard, not a neon badge. */
export default function ShareCardScreen() {
  useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const shotRef = useRef<React.ComponentRef<typeof ViewShot> | null>(null);
  const activeRound = useActiveRound((s) => s.round);

  const local = useQuery({
    queryKey: ['round', id],
    queryFn: () => fetchLocalRound(id!),
    enabled: !!id && activeRound?.id !== id,
  });
  const round = activeRound?.id === id ? activeRound : local.data ?? null;

  const stats = useMemo(
    () => (round ? round.participants.map((p) => participantStats(p, round, round.scores)) : []),
    [round],
  );

  const share = async () => {
    if (!round) return;
    try {
      const uri = await shotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your round' });
      } else {
        // Fallback: text share
        const lines = stats.map(
          (s) => `${s.displayName}: ${s.totalStrokes} (${formatToPar(s.toPar)})`,
        );
        await Share.share({
          message: `${round.courseName} — ${new Date(round.startedAt).toLocaleDateString()}\n${lines.join('\n')}\n\nTracked with Arcfore`,
        });
      }
    } catch {
      // user cancelled or capture failed — no-op
    }
  };

  if (!round) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Share' }} />
        <Text variant="body" secondary>
          {local.isFetching ? 'Loading…' : 'Round not found.'}
        </Text>
      </View>
    );
  }

  const parTotal = round.holeData.reduce((n: number, h) => n + h.par, 0);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Share card', presentation: 'modal' }} />
      <Text variant="caption" secondary style={{ marginTop: spacing.md }}>
        Share the result, not the location. The card only shows names, course, and scores.
      </Text>

      <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.shotWrap}>
        <View style={[styles.card, { backgroundColor: '#102E25' }]}>
          <Text style={[styles.brand, { color: '#C8A46B' }]}>ARCF O R E</Text>
          <Text style={styles.course} numberOfLines={2}>
            {round.courseName}
          </Text>
          <Text style={styles.meta}>
            {new Date(round.startedAt).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}{' '}
            · {round.holesPlanned} holes · Par {parTotal}
          </Text>

          <View style={styles.divider} />

          {stats
            .slice()
            .sort((a, b) => a.toPar - b.toPar)
            .map((s, i) => (
              <View key={s.participantId} style={styles.row}>
                <Text style={[styles.rank, { color: '#C8A46B' }]}>{i + 1}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {s.displayName}
                </Text>
                <Text style={styles.strokes}>{s.totalStrokes}</Text>
                <Text style={[styles.toPar, { color: s.toPar <= 0 ? '#7FC9A8' : '#F7F4EC' }]}>
                  {formatToPar(s.toPar)}
                </Text>
              </View>
            ))}

          <View style={styles.divider} />
          <Text style={styles.footer}>Your game. Understood.</Text>
        </View>
      </ViewShot>

      <Button
        title="Share"
        size="lg"
        fullWidth
        icon={<Share2 size={16} color="#F7F4EC" />}
        onPress={share}
        style={{ marginTop: spacing.lg }}
      />
      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shotWrap: { marginTop: spacing.lg, alignSelf: 'center' },
  card: {
    width: 340,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 6,
    textAlign: 'center',
  },
  course: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    color: '#F7F4EC',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#C6D4CB',
    textAlign: 'center',
  },
  divider: { height: 1, backgroundColor: '#2E4A3E', marginVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rank: { width: 24, fontFamily: fonts.serifBold, fontSize: 16 },
  name: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: '#F7F4EC' },
  strokes: { width: 44, textAlign: 'right', fontFamily: fonts.sansBold, fontSize: 18, color: '#F7F4EC', fontVariant: ['tabular-nums'] },
  toPar: { width: 44, textAlign: 'right', fontFamily: fonts.sansBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  footer: { fontFamily: fonts.serifRegular, fontSize: 12, color: '#9AB3A6', textAlign: 'center', fontStyle: 'italic' },
});
