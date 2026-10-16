import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  CloudOff,
  Flag,
  ListChecks,
  RotateCcw,
  Satellite,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ScoreStepper } from '@/components/golf/ScoreStepper';
import { ScoreCelebration } from '@/components/golf/Celebration';
import { Chip } from '@/components/ui/Chip';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing, tabularNums } from '@/theme/theme';
import { useActiveRound } from '@/store/activeRound';
import { subscribeToRound } from '@/lib/realtime/roundChannel';
import { flushOutbox } from '@/lib/offline/sync';
import { getGreenCenters } from '@/lib/api/courses';
import { distanceInUnits, formatDistance } from '@/lib/geo';
import {
  findScore,
  formatToPar,
  participantStats,
  playedHoleNumbers,
  scoreName,
} from '@/lib/scoring/engine';
import { useProfile } from '@/lib/hooks/data';
import { isClerkConfigured, isSupabaseConfigured } from '@/lib/config';
import type { HoleScore, RoundParticipant } from '@/types/domain';

type ExtraKey = 'putts' | 'fairway' | 'gir' | 'penalties';

export default function ActiveRoundScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ hole?: string }>();
  const { userId } = useAuth();
  const profile = useProfile(isClerkConfigured() ? userId : null);
  const units = profile.data?.units ?? 'yards';

  const round = useActiveRound((s) => s.round);
  const pendingCount = useActiveRound((s) => s.pendingCount);
  const syncing = useActiveRound((s) => s.syncing);
  const updateScore = useActiveRound((s) => s.updateScore);
  const undoLast = useActiveRound((s) => s.undoLast);
  const undoStack = useActiveRound((s) => s.undoStack);
  const setStatus = useActiveRound((s) => s.setStatus);

  const holeNumbers = useMemo(() => (round ? playedHoleNumbers(round) : []), [round]);
  const [holeIndex, setHoleIndex] = useState(() => {
    const start = parseInt(params.hole ?? '0', 10);
    if (!round) return 0;
    const i = holeNumbers.indexOf(start || holeNumbers[0]);
    return i >= 0 ? i : 0;
  });
  const [participantIndex, setParticipantIndex] = useState(0);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [celebration, setCelebration] = useState<
    'Hole in one' | 'Albatross' | 'Eagle' | 'Birdie' | null
  >(null);
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);

  const hole = holeNumbers[holeIndex] ?? 1;
  const info = round?.holeData.find((h) => h.hole === hole) ?? null;
  const participant: RoundParticipant | null = round?.participants[participantIndex] ?? null;
  const score: HoleScore | null =
    round && participant ? findScore(round.scores, participant.id, hole) : null;

  const myStats = useMemo(
    () => (round && participant ? participantStats(participant, round, round.scores) : null),
    [round, participant],
  );

  const greens = useQuery({
    queryKey: ['greens', round?.courseProviderId],
    queryFn: () => getGreenCenters(round!.courseProviderId!),
    enabled: !!round?.courseProviderId && round.courseProvider !== 'manual',
    staleTime: 10 * 60_000,
    retry: false,
  });
  const greenCenter = greens.data?.available
    ? greens.data.holes.find((h) => h.hole === hole)
    : null;

  // Realtime subscription for multi-device rounds
  useEffect(() => {
    if (!round?.isMultiDevice || !isSupabaseConfigured()) return;
    const sub = subscribeToRound(round.id);
    return () => {
      void sub?.unsubscribe();
    };
  }, [round?.id, round?.isMultiDevice]);

  const hasGreenCenter = greenCenter != null;

  // GPS position watch — only used when the provider published green centers
  useEffect(() => {
    if (!hasGreenCenter) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsDenied(true);
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
        (p) => {
          if (cancelled) return;
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        },
      );
    })().catch(() => setGpsDenied(true));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [hasGreenCenter]);

  if (!round) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ title: 'Round', headerBackVisible: false }} />
        <Text variant="body" secondary>
          No active round.
        </Text>
        <Button title="Start a round" onPress={() => router.replace('/round/setup')} />
      </View>
    );
  }

  const setCell = (patch: Partial<HoleScore>) => {
    if (!participant) return;
    const before = score?.strokes ?? null;
    updateScore(participant.id, hole, patch);
    const next = patch.strokes ?? before;
    if (info && patch.strokes != null && patch.strokes !== before) {
      const name = scoreName(patch.strokes, info.par);
      if (name === 'Birdie' || name === 'Eagle' || name === 'Albatross' || name === 'Hole in one') {
        setCelebration(name);
      }
    }
    void next;
  };

  const prev = () => setHoleIndex((i) => Math.max(0, i - 1));
  const next = () => setHoleIndex((i) => Math.min(holeNumbers.length - 1, i + 1));

  const scoredCount = holeNumbers.filter((h) =>
    round.participants.some((p) => findScore(round.scores, p.id, h)?.strokes != null),
  ).length;

  const finish = () => {
    const unscored = holeNumbers.length - scoredCount;
    Alert.alert(
      'Finish round?',
      unscored > 0
        ? `${unscored} hole${unscored > 1 ? 's' : ''} still have no score. Unscored holes are left blank on the card.`
        : 'All holes scored — nice round.',
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Finish round',
          onPress: () => {
            setStatus('completed');
            void flushOutbox();
            router.replace(`/round/${round.id}/summary`);
          },
        },
      ],
    );
  };

  const distToCenter = () => {
    if (!pos || !greenCenter) return null;
    const d = distanceInUnits(
      { latitude: pos.lat, longitude: pos.lng },
      { latitude: greenCenter.latitude, longitude: greenCenter.longitude },
      units,
    );
    return formatDistance(d, units);
  };

  const extraValue = (key: ExtraKey) => {
    switch (key) {
      case 'putts': return score?.putts ?? null;
      case 'fairway': return score?.fairway ?? null;
      case 'gir': return score?.gir ?? null;
      case 'penalties': return score?.penalties ?? null;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: round.courseName,
          headerBackVisible: false,
          headerRight: () => (
            <View style={styles.hdrRight}>
              <Pressable onPress={() => router.push('/round/scorecard')} hitSlop={8}>
                <ListChecks size={20} color={colors.forest} />
              </Pressable>
              <Pressable onPress={finish} hitSlop={8}>
                <Flag size={20} color={colors.forest} />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* sync status strip */}
      <View style={[styles.syncBar, { borderBottomColor: colors.border }]}>
        <View style={styles.syncLeft}>
          {pendingCount > 0 ? (
            <>
              <CloudOff size={13} color={colors.textSecondary} />
              <Text variant="micro" secondary>
                {syncing ? 'Syncing…' : `${pendingCount} pending`}
              </Text>
            </>
          ) : (
            <Text variant="micro" secondary>
              {round.isMultiDevice ? `Live · code ${round.shareCode ?? ''}` : 'Saved locally'}
            </Text>
          )}
        </View>
        <Pressable
          onPress={undoLast}
          disabled={undoStack.length === 0}
          style={{ opacity: undoStack.length ? 1 : 0.35 }}
          hitSlop={8}
        >
          <View style={styles.syncLeft}>
            <RotateCcw size={13} color={colors.textSecondary} />
            <Text variant="micro" secondary>
              Undo
            </Text>
          </View>
        </Pressable>
      </View>

      {/* hole pager */}
      <View style={styles.holeHeader}>
        <Pressable onPress={prev} disabled={holeIndex === 0} style={styles.pagerBtn}>
          <Text variant="h3" style={{ opacity: holeIndex === 0 ? 0.25 : 1 }}>
            ‹
          </Text>
        </Pressable>
        <View style={styles.holeCenter}>
          <Text variant="score" style={{ color: colors.forest }}>
            {hole}
          </Text>
          <Text variant="bodyStrong" secondary>
            Par {info?.par ?? '—'}
            {info?.yards != null ? ` · ${info.yards} ${units === 'meters' ? 'm*' : 'yds'}` : ''}
            {info?.handicap != null ? ` · hcp ${info.handicap}` : ''}
          </Text>
          {info?.yards != null && !greenCenter ? (
            <Text variant="micro" secondary>
              Tee-sheet yardage
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={next}
          disabled={holeIndex >= holeNumbers.length - 1}
          style={styles.pagerBtn}
        >
          <Text variant="h3" style={{ opacity: holeIndex >= holeNumbers.length - 1 ? 0.25 : 1 }}>
            ›
          </Text>
        </Pressable>
      </View>

      {/* GPS distances when the provider supplies green centers */}
      {greenCenter ? (
        <View style={[styles.gpsRow, { backgroundColor: colors.sage }]}>
          <Satellite size={14} color={colors.forest} />
          {pos ? (
            <>
              <Text variant="bodyStrong" style={tabularNums}>
                {distToCenter() ?? '—'}
              </Text>
              <Text variant="micro" secondary>
                to center{pos.accuracy ? ` · ±${Math.round(pos.accuracy)}m` : ''}
              </Text>
            </>
          ) : (
            <Text variant="caption" secondary>
              {gpsDenied ? 'Location off — enable in Settings' : 'Acquiring GPS…'}
            </Text>
          )}
        </View>
      ) : null}

      {/* player tabs */}
      <View style={styles.playerTabs}>
        {round.participants.map((p, i) => {
          const sel = i === participantIndex;
          const ps = participantStats(p, round, round.scores);
          return (
            <Pressable
              key={p.id}
              onPress={() => setParticipantIndex(i)}
              style={[
                styles.playerTab,
                sel && { backgroundColor: colors.forest, borderColor: colors.forest },
              ]}
            >
              <Text variant="label" style={{ color: sel ? '#F7F4EC' : colors.text }} numberOfLines={1}>
                {p.displayName}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: sel ? colors.brass : colors.textSecondary,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {ps.holesPlayed > 0 ? `${ps.totalStrokes} (${formatToPar(ps.toPar)})` : '—'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* score entry */}
      <View style={styles.scoreArea}>
        <ScoreStepper
          value={score?.strokes ?? null}
          onChange={(v) => setCell({ strokes: v })}
          par={info?.par}
          label={`${participant?.displayName ?? ''} — hole ${hole}`}
        />
        {myStats && myStats.holesPlayed > 0 ? (
          <Text variant="body" secondary>
            {myStats.totalStrokes} strokes · {formatToPar(myStats.toPar)} through {myStats.holesPlayed}
          </Text>
        ) : null}

        <Pressable onPress={() => setExtrasOpen((v) => !v)}>
          <Text variant="label" style={{ color: colors.forest }}>
            {extrasOpen ? '− Less detail' : '+ Putts · fairway · GIR · penalties'}
          </Text>
        </Pressable>

        {extrasOpen ? (
          <Animated.View entering={FadeIn.duration(150)} style={styles.extras}>
            <View style={styles.extraRow}>
              <Text variant="label" secondary style={styles.extraLabel}>
                Putts
              </Text>
              <View style={styles.extraChips}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <Chip
                    key={n}
                    label={String(n)}
                    selected={extraValue('putts') === n}
                    onPress={() => setCell({ putts: extraValue('putts') === n ? null : n })}
                  />
                ))}
              </View>
            </View>
            {info?.par !== 3 ? (
              <View style={styles.extraRow}>
                <Text variant="label" secondary style={styles.extraLabel}>
                  Fairway
                </Text>
                <View style={styles.extraChips}>
                  {(
                    [
                      ['hit', 'Hit'],
                      ['left', 'Left'],
                      ['right', 'Right'],
                    ] as const
                  ).map(([v, l]) => (
                    <Chip
                      key={v}
                      label={l}
                      selected={extraValue('fairway') === v}
                      onPress={() => setCell({ fairway: extraValue('fairway') === v ? null : v })}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.extraRow}>
              <Text variant="label" secondary style={styles.extraLabel}>
                GIR
              </Text>
              <View style={styles.extraChips}>
                <Chip
                  label="Yes"
                  selected={extraValue('gir') === true}
                  onPress={() => setCell({ gir: extraValue('gir') === true ? null : true })}
                />
                <Chip
                  label="No"
                  selected={extraValue('gir') === false}
                  onPress={() => setCell({ gir: extraValue('gir') === false ? null : false })}
                />
              </View>
            </View>
            <View style={styles.extraRow}>
              <Text variant="label" secondary style={styles.extraLabel}>
                Penalties
              </Text>
              <View style={styles.extraChips}>
                {[0, 1, 2, 3].map((n) => (
                  <Chip
                    key={n}
                    label={String(n)}
                    selected={extraValue('penalties') === n}
                    onPress={() => setCell({ penalties: extraValue('penalties') === n ? null : n })}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>

      {/* hole strip */}
      <View style={styles.stripWrap}>
        <FlatList
          data={holeNumbers}
          horizontal
          keyExtractor={(h) => String(h)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          renderItem={({ item: h, index }) => {
            const s = participant ? findScore(round.scores, participant.id, h) : null;
            const hp = round.holeData.find((x) => x.hole === h)?.par ?? null;
            const diff = s?.strokes != null && hp != null ? s.strokes - hp : null;
            return (
              <Pressable
                onPress={() => setHoleIndex(index)}
                style={[
                  styles.stripCell,
                  { borderColor: colors.border },
                  h === hole && { backgroundColor: colors.forest, borderColor: colors.forest },
                  diff != null &&
                    diff <= -1 && { borderColor: colors.birdie, borderWidth: 1.5 },
                ]}
              >
                <Text
                  variant="caption"
                  style={{ color: h === hole ? colors.brass : colors.textSecondary }}
                >
                  {h}
                </Text>
                <Text
                  variant="bodyStrong"
                  style={[tabularNums, { color: h === hole ? '#F7F4EC' : colors.text }]}
                >
                  {s?.strokes ?? '·'}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {celebration ? <ScoreCelebration name={celebration} onDone={() => setCelebration(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hdrRight: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  syncBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  holeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  pagerBtn: { width: 56, alignItems: 'center' },
  holeCenter: { alignItems: 'center' },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  playerTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  playerTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#00000018',
    minWidth: 76,
    alignItems: 'center',
  },
  scoreArea: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  extras: { gap: spacing.sm, alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  extraLabel: { width: 60 },
  extraChips: { flexDirection: 'row', gap: spacing.sm },
  stripWrap: { marginTop: 'auto', paddingBottom: spacing.lg },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  stripCell: {
    width: 44,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
});
