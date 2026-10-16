import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { Share2, Sparkles } from 'lucide-react-native';

import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ScorecardGrid } from '@/components/golf/ScorecardGrid';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { useActiveRound } from '@/store/activeRound';
import {
  findScore,
  formatToPar,
  participantStats,
  playedHoleNumbers,
  scoreName,
} from '@/lib/scoring/engine';
import { fetchRemoteRoundDomain } from '@/lib/offline/sync';
import { generateRecap } from '@/lib/api/ai';
import { isClerkConfigured, isSupabaseConfigured } from '@/lib/config';
import { useProfile } from '@/lib/hooks/data';

export default function RoundSummaryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const activeRound = useActiveRound((s) => s.round);

  const round = activeRound?.id === id ? activeRound : null;

  // If the round isn't the active one (viewing history), fetch it.
  const remote = useQuery({
    queryKey: ['round', id],
    queryFn: () => fetchRemoteRoundDomain(id!),
    enabled: !!id && !round && isSupabaseConfigured(),
  });
  const shown = round ?? remote.data ?? null;

  const profile = useProfile(isClerkConfigured() ? userId : null);

  const stats = useMemo(() => {
    if (!shown) return [];
    return shown.participants.map((p) => participantStats(p, shown, shown.scores));
  }, [shown]);

  const recapInput = useMemo(() => {
    if (!shown || shown.status !== 'completed' || !userId) return null;
    const me = shown.participants.find((p) => p.userId === userId);
    if (!me) return null;
    const s = participantStats(me, shown, shown.scores);
    const holes = playedHoleNumbers(shown);
    const scored = holes
      .map((h) => ({ h, score: findScore(shown.scores, me.id, h) }))
      .filter((x) => x.score?.strokes != null)
      .map((x) => ({
        hole: x.h,
        name: scoreName(x.score!.strokes, shown.holeData.find((d) => d.hole === x.h)?.par ?? 4) ?? '',
        diff: x.score!.strokes! - (shown.holeData.find((d) => d.hole === x.h)?.par ?? 4),
      }));
    return {
      courseName: shown.courseName,
      holesPlanned: shown.holesPlanned,
      toPar: s.toPar,
      totalStrokes: s.totalStrokes,
      putts: s.puttsTotal,
      girPct: s.girTracked ? (s.girCount / s.girTracked) * 100 : null,
      fairwayPct: s.fairwaysTracked ? (s.fairwaysHit / s.fairwaysTracked) * 100 : null,
      birdies: s.birdies,
      pars: s.pars,
      bogeys: s.bogeys,
      doublePlus: s.doublePlus,
      worstHoles: scored
        .filter((x) => x.diff > 0)
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 3)
        .map((x) => ({ hole: x.hole, scoreName: x.name })),
      bestHoles: scored
        .filter((x) => x.diff < 0)
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 3)
        .map((x) => ({ hole: x.hole, scoreName: x.name })),
      skillLevel: profile.data?.skillLevel ?? 'intermediate',
    };
  }, [shown, userId, profile.data?.skillLevel]);

  const recap = useQuery({
    queryKey: ['recap', id],
    queryFn: () => generateRecap(recapInput!),
    enabled: !!recapInput,
    staleTime: Infinity,
    retry: false,
  });

  if (!shown) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Round' }} />
        <Text variant="body" secondary>
          {remote.isFetching ? 'Loading round…' : 'Round not found.'}
        </Text>
      </View>
    );
  }

  const winner = stats.length ? [...stats].sort((a, b) => a.toPar - b.toPar)[0] : null;

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: shown.courseName, headerBackVisible: false }} />
      <View style={styles.hero}>
        <Text variant="caption" secondary style={{ letterSpacing: 1.5 }}>
          {shown.status === 'completed' ? 'ROUND COMPLETE' : 'ROUND'} ·{' '}
          {new Date(shown.startedAt).toLocaleDateString()}
        </Text>
        <Text variant="display" style={{ color: colors.forest }} numberOfLines={2}>
          {shown.courseName}
        </Text>
        {winner ? (
          <Text variant="body" secondary>
            {winner.displayName} took it at {formatToPar(winner.toPar)} ({winner.totalStrokes})
          </Text>
        ) : null}
      </View>

      {/* standings */}
      <Card style={styles.card}>
        {stats
          .slice()
          .sort((a, b) => a.toPar - b.toPar)
          .map((s, i) => (
            <View key={s.participantId} style={styles.standingRow}>
              <Text variant="h3" style={{ width: 28, color: colors.brass }}>
                {i + 1}
              </Text>
              <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {s.displayName}
              </Text>
              <Text variant="number">{s.totalStrokes}</Text>
              <Text
                variant="bodyStrong"
                style={{ width: 44, textAlign: 'right', color: s.toPar <= 0 ? colors.birdie : colors.text }}
              >
                {formatToPar(s.toPar)}
              </Text>
            </View>
          ))}
      </Card>

      {/* AI recap */}
      {recap.data ? (
        <Card dark style={styles.card}>
          <View style={styles.recapHeader}>
            <Sparkles size={14} color={colors.brass} />
            <Text variant="micro" style={{ color: colors.brass }}>
              ARCFORE RECAP
            </Text>
          </View>
          {recap.data.wentWell.map((w) => (
            <Text key={w} variant="body" style={{ color: '#EDE7DA' }}>
              · {w}
            </Text>
          ))}
          {recap.data.biggestOpportunity ? (
            <Text variant="bodyStrong" style={{ color: '#F7F4EC', marginTop: spacing.sm }}>
              Biggest opportunity: {recap.data.biggestOpportunity}
            </Text>
          ) : null}
          {recap.data.practiceFocus ? (
            <Text variant="body" style={{ color: '#C6D4CB', marginTop: spacing.xs }}>
              Practice focus: {recap.data.practiceFocus}
            </Text>
          ) : null}
          {recap.data.nextRoundGoal ? (
            <Text variant="body" style={{ color: '#C6D4CB', marginTop: spacing.xs }}>
              Next round: {recap.data.nextRoundGoal}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* scorecard */}
      <SectionHeader title="Scorecard" />
      <ScorecardGrid
        holeNumbers={playedHoleNumbers(shown)}
        holeData={shown.holeData}
        participants={shown.participants}
        scores={shown.scores}
      />

      <View style={styles.ctaRow}>
        <Button
          title="Share scorecard"
          variant="outline"
          icon={<Share2 size={16} color={colors.text} />}
          onPress={() => router.push(`/round/${shown.id}/share`)}
        />
        <Button title="Done" onPress={() => router.replace('/(tabs)')} />
      </View>
      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.xs },
  card: { marginBottom: spacing.md },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  recapHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  ctaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, justifyContent: 'flex-end' },
});
