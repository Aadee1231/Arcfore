import { useAuthUser } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { TrendChart } from '@/components/charts/TrendChart';
import { Card } from '@/components/ui/Card';
import { EmptyState, Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { careerStats, unofficialHandicapEstimate } from '@/lib/analytics/stats';
import { usePracticeSessions, useRounds, useSwingAnalyses } from '@/lib/hooks/data';
import { formatToPar } from '@/lib/scoring/engine';
import { useColors } from '@/theme/ThemeProvider';
import { spacing, tabularNums } from '@/theme/theme';

function StatTile({ label, value, sub, wide }: { label: string; value: string; sub?: string; wide?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.bgRaised }, wide && styles.tileWide]}>
      <Text variant="numberLg" style={tabularNums}>
        {value}
      </Text>
      <Text variant="caption" secondary>
        {label}
      </Text>
      {sub ? (
        <Text variant="micro" secondary>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export default function ProgressScreen() {
  const colors = useColors();
  const router = useRouter();
  const { userId } = useAuthUser();
  const rounds = useRounds();
  const analyses = useSwingAnalyses();
  const practice = usePracticeSessions();

  const stats = useMemo(() => {
    if (!userId || !rounds.data?.length) return null;
    return careerStats(rounds.data.map((r) => ({ round: r, scores: r.scores })), userId);
  }, [rounds.data, userId]);

  const handicap = useMemo(() => {
    if (!userId || !rounds.data?.length) return null;
    return unofficialHandicapEstimate(rounds.data.map((r) => ({ round: r, scores: r.scores })), userId);
  }, [rounds.data, userId]);

  const trend = stats?.trend.slice(-10).map((t) => t.toPar) ?? [];
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" style={{ color: colors.forest }}>
          Progress
        </Text>
        <Text variant="body" secondary>
          Real numbers from rounds you've actually played.
        </Text>
      </View>

      {!stats || stats.roundsCompleted === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={26} color={colors.textSecondary} />}
            title="No stats yet"
            message="Complete a round and your trends, averages, and bests will appear here — nothing is made up."
          />
        </Card>
      ) : (
        <>
          <View style={styles.grid}>
            <StatTile label="Rounds played" value={String(stats.roundsCompleted)} sub={`${stats.rounds18}×18 · ${stats.rounds9}×9`} />
            <StatTile label="Avg score (18)" value={stats.averageScore18 != null ? String(Math.round(stats.averageScore18)) : '—'} />
            <StatTile label="Avg vs par" value={stats.averageToPar != null ? formatToPar(Math.round(stats.averageToPar)) : '—'} sub="per 18 holes" />
            <StatTile
              label="Best round"
              value={stats.bestRoundToPar ? formatToPar(stats.bestRoundToPar.toPar) : '—'}
              sub={stats.bestRoundToPar?.courseName}
            />
            <StatTile label="Avg putts" value={stats.averagePutts != null ? stats.averagePutts.toFixed(1) : '—'} />
            <StatTile label="Practice sessions" value={String(practice.data?.length ?? 0)} />
          </View>

          {handicap != null ? (
            <Card style={styles.hcpCard}>
              <Text variant="caption" secondary>
                UNOFFICIAL INDEX ESTIMATE
              </Text>
              <Text variant="display" style={{ color: colors.forest }}>
                {handicap.toFixed(1)}
              </Text>
              <Text variant="caption" secondary>
                Best-8 average vs par over your last 20 rounds — not a WHS Handicap Index.
              </Text>
            </Card>
          ) : null}

          {trend.length >= 2 ? (
            <View>
              <SectionHeader title="Scoring trend" />
              <Card>
                <TrendChart values={trend} width={320} height={88} />
                <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>
                  Score vs par, oldest → newest
                </Text>
              </Card>
            </View>
          ) : null}

          <SectionHeader title="Scoring breakdown" />
          <Card>
            <View style={styles.statRow}>
              <Text variant="label" secondary>Birdie rate</Text>
              <Text variant="number">{pct(stats.birdieRate)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="label" secondary>Par rate</Text>
              <Text variant="number">{pct(stats.parRate)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="label" secondary>Bogey rate</Text>
              <Text variant="number">{pct(stats.bogeyRate)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="label" secondary>Fairways hit</Text>
              <Text variant="number">{pct(stats.fairwayPct)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="label" secondary>Greens in regulation</Text>
              <Text variant="number">{pct(stats.girPct)}</Text>
            </View>
          </Card>

          <SectionHeader title="By hole par" />
          <View style={styles.grid}>
            <StatTile label="Par 3 avg vs par" value={stats.scoringByPar.par3 != null ? formatToPar(Math.round((stats.scoringByPar.par3 + Number.EPSILON) * 10) / 10) : '—'} />
            <StatTile label="Par 4 avg vs par" value={stats.scoringByPar.par4 != null ? formatToPar(Math.round((stats.scoringByPar.par4 + Number.EPSILON) * 10) / 10) : '—'} />
            <StatTile label="Par 5 avg vs par" value={stats.scoringByPar.par5 != null ? formatToPar(Math.round((stats.scoringByPar.par5 + Number.EPSILON) * 10) / 10) : '—'} />
          </View>

          <SectionHeader title="Courses played" />
          {stats.coursesPlayed.map((c) => (
            <Card key={c.courseName} style={styles.courseRow}>
              <View style={styles.statRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>{c.courseName}</Text>
                  <Text variant="caption" secondary>{c.rounds} round{c.rounds > 1 ? 's' : ''}</Text>
                </View>
                <Text variant="number">
                  {c.bestToPar != null ? formatToPar(c.bestToPar) : '—'}
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {(analyses.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title="Swing work" />
          <Card onPress={() => router.push('/(tabs)/coach')}>
            <Text variant="bodyStrong">{analyses.data!.length} swing {analyses.data!.length === 1 ? 'analysis' : 'analyses'}</Text>
            <Text variant="caption" secondary>
              Latest: {analyses.data![0].topPriority?.title ?? analyses.data![0].summary}
            </Text>
          </Card>
        </>
      ) : null}

      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.lg, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tile: {
    flexGrow: 1,
    minWidth: '30%',
    padding: spacing.md,
    borderRadius: 14,
    gap: 2,
    alignItems: 'flex-start',
  },
  tileWide: { minWidth: '48%' },
  hcpCard: { marginBottom: spacing.lg, gap: 2 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  courseRow: { marginBottom: spacing.sm },
});
