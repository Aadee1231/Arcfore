import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthUser } from '@/lib/auth';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Flag, Play, Scan, Target } from 'lucide-react-native';

import { EmptyState, Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendChart } from '@/components/charts/TrendChart';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing, } from '@/theme/theme';
import { useActiveRound } from '@/store/activeRound';
import {
  useOneThing,
  useProfile,
  useRounds,
  useSwingAnalyses,
} from '@/lib/hooks/data';
import { careerStats } from '@/lib/analytics/stats';
import { formatToPar, participantStats } from '@/lib/scoring/engine';
import { isClerkConfigured } from '@/lib/config';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { userId } = useAuthUser();
  const { displayName } = useAuthUser();
  const uid = isClerkConfigured() ? userId : 'dev-preview';

  const profile = useProfile(isClerkConfigured() ? userId : null);
  const rounds = useRounds(isClerkConfigured() ? userId : null);
  const analyses = useSwingAnalyses(isClerkConfigured() ? userId : null);
  const oneThing = useOneThing(isClerkConfigured() ? userId : null);
  const activeRound = useActiveRound((s) => s.round);

  const firstName =
    profile.data?.displayName?.split(' ')[0] ??
    displayName ??
    'Golfer';

  const stats = useMemo(() => {
    if (!uid || !rounds.data?.length) return null;
    return careerStats(rounds.data.map((r) => ({ round: r, scores: r.scores })), uid);
  }, [rounds.data, uid]);

  const lastRound = rounds.data?.find((r) => r.status === 'completed');
  const lastRoundStats = useMemo(() => {
    if (!lastRound || !uid) return null;
    const me = lastRound.participants.find((p) => p.userId === uid);
    return me ? participantStats(me, lastRound, lastRound.scores) : null;
  }, [lastRound, uid]);

  const lastAnalysis = analyses.data?.[0];
  const trendValues = stats?.trend.slice(-8).map((t) => t.toPar) ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen scroll>
      {/* Greeting */}
      <View style={styles.greet}>
        <Text variant="caption" secondary style={styles.kicker}>
          {greeting.toUpperCase()}
        </Text>
        <Text variant="display" style={{ color: colors.forest }}>
          {firstName}.
        </Text>
      </View>

      {/* Active round banner */}
      {activeRound?.status === 'active' ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card dark style={styles.activeCard} onPress={() => router.push('/round/active')}>
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.brass, letterSpacing: 1 }}>
                  ROUND IN PROGRESS
                </Text>
                <Text variant="h3" style={{ color: '#F7F4EC' }} numberOfLines={1}>
                  {activeRound.courseName}
                </Text>
                <Text variant="caption" style={{ color: '#9AB3A6' }}>
                  {activeRound.participants.length} player{activeRound.participants.length > 1 ? 's' : ''} · started{' '}
                  {new Date(activeRound.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <View style={[styles.resumeBadge, { backgroundColor: colors.brass }]}>
                <Play size={18} color={colors.forest} fill={colors.forest} />
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {/* Primary CTA */}
      <View style={styles.ctaRow}>
        <Button
          title={activeRound?.status === 'active' ? 'Start a new round' : 'Start a round'}
          size="xl"
          fullWidth
          onPress={() => router.push('/round/setup')}
          icon={<Play size={20} color="#F7F4EC" fill="#F7F4EC" />}
        />
        <Button
          title="Analyze swing"
          variant="outline"
          size="lg"
          onPress={() => router.push('/coach/record')}
          icon={<Scan size={18} color={colors.text} />}
        />
      </View>

      {/* One Thing */}
      {oneThing.data ? (
        <Card style={styles.oneThing} onPress={() => router.push('/practice')}>
          <View style={styles.oneThingHeader}>
            <Target size={14} color={colors.brass} />
            <Text variant="micro" style={{ color: colors.brass }}>
              YOUR ONE THING
            </Text>
          </View>
          <Text variant="h3">{oneThing.data.focus}</Text>
          <Text variant="body" secondary numberOfLines={2}>
            {oneThing.data.explanation}
          </Text>
          {oneThing.data.drillName ? (
            <Text variant="label" style={{ color: colors.forest }}>
              Drill: {oneThing.data.drillName} →
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* Last round */}
      <View>
        <SectionHeader title="Last round" />
        {lastRound && lastRoundStats ? (
          <Card onPress={() => router.push(`/round/${lastRound.id}/summary`)}>
            <View style={styles.lastRoundRow}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {lastRound.courseName}
                </Text>
                <Text variant="caption" secondary>
                  {new Date(lastRound.startedAt).toLocaleDateString()} · {lastRound.holesPlanned} holes
                </Text>
              </View>
              <View style={styles.scoreCol}>
                <Text variant="numberLg">{lastRoundStats.totalStrokes}</Text>
                <Text variant="caption" style={{ color: lastRoundStats.toPar <= 0 ? colors.birdie : colors.textSecondary }}>
                  {formatToPar(lastRoundStats.toPar)}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Flag size={26} color={colors.textSecondary} />}
              title="No rounds yet"
              message="Your first scorecard will live here. Play nine or eighteen and track every shot."
            />
          </Card>
        )}
      </View>

      {/* Trend */}
      {trendValues.length >= 2 ? (
        <View>
          <SectionHeader title="Recent form" />
          <Card>
            <TrendChart values={trendValues} width={320} />
            <Text variant="caption" secondary style={{ marginTop: spacing.sm }}>
              Score vs par across your last {trendValues.length} rounds
            </Text>
          </Card>
        </View>
      ) : null}

      {/* Last analysis */}
      {lastAnalysis ? (
        <View>
          <SectionHeader title="Latest swing analysis" />
          <Card onPress={() => router.push(`/coach/analysis/${lastAnalysis.id}`)}>
            <View style={styles.analysisRow}>
              <Scan size={20} color={colors.brass} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {lastAnalysis.topPriority?.title ?? lastAnalysis.summary}
                </Text>
                <Text variant="caption" secondary>
                  {new Date(lastAnalysis.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Card>
        </View>
      ) : null}

      {/* Quick links */}
      <View style={styles.quickRow}>
        <Pressable style={[styles.quickLink, { backgroundColor: colors.sage }]} onPress={() => router.push('/bag')}>
          <Text variant="label">My bag</Text>
          <Text variant="caption" secondary>
            Clubs & distances
          </Text>
        </Pressable>
        <Pressable style={[styles.quickLink, { backgroundColor: colors.sage }]} onPress={() => router.push('/(tabs)/play')}>
          <Text variant="label">Find a course</Text>
          <Text variant="caption" secondary>
            Search real courses
          </Text>
        </Pressable>
      </View>

      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: { marginTop: spacing.lg, marginBottom: spacing.lg },
  kicker: { letterSpacing: 2, marginBottom: 2 },
  activeCard: { marginBottom: spacing.md },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resumeBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaRow: { gap: spacing.sm, marginBottom: spacing.lg },
  oneThing: { marginBottom: spacing.lg, borderLeftWidth: 3, borderLeftColor: '#C8A46B', gap: spacing.xs },
  oneThingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lastRoundRow: { flexDirection: 'row', alignItems: 'center' },
  scoreCol: { alignItems: 'flex-end' },
  analysisRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  quickLink: { flex: 1, padding: spacing.lg, borderRadius: radius.md, gap: 2 },
});
