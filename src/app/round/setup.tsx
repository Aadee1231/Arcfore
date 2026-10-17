import { useAuthUser } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, SegmentedControl } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { getCourse } from '@/lib/api/courses';
import { useProfile } from '@/lib/hooks/data';
import { newId } from '@/lib/id';
import { useActiveRound } from '@/store/activeRound';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import type { CourseDetail, RoundFormat, TeeSet } from '@/types/domain';

export default function RoundSetupScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string; manualCourse?: string }>();
  const { userId, displayName } = useAuthUser();
  const profile = useProfile();
  const createRound = useActiveRound((s) => s.createRound);
  const activeRound = useActiveRound((s) => s.round);

  const manualCourse = useMemo<CourseDetail | null>(() => {
    try {
      return params.manualCourse ? (JSON.parse(params.manualCourse) as CourseDetail) : null;
    } catch {
      return null;
    }
  }, [params.manualCourse]);

  const courseQuery = useQuery({
    queryKey: ['course', params.courseId],
    queryFn: () => getCourse(params.courseId!),
    enabled: !!params.courseId && !manualCourse,
    staleTime: 10 * 60_000,
  });
  const course = manualCourse ?? courseQuery.data ?? null;

  const [holesPlanned, setHolesPlanned] = useState<9 | 18>(18);
  const [startingHole, setStartingHole] = useState<1 | 10>(1);
  const [format, setFormat] = useState<RoundFormat>('stroke');
  const [teeId, setTeeId] = useState<string | null>(null);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [newGuest, setNewGuest] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tee: TeeSet | null = useMemo(() => {
    if (!course?.teeSets.length) return null;
    return course.teeSets.find((t) => t.id === teeId) ?? course.teeSets[0];
  }, [course, teeId]);

  const addGuest = () => {
    const name = newGuest.trim();
    if (!name) return;
    if (guestNames.length >= 3) {
      setError('Maximum 4 players total.');
      return;
    }
    if (guestNames.some((g) => g.toLowerCase() === name.toLowerCase())) {
      setError('That name is already in the group.');
      return;
    }
    setGuestNames([...guestNames, name]);
    setNewGuest('');
    setError(null);
  };

  const start = () => {
    if (!course) {
      setError('Pick a course first.');
      return;
    }
    if (activeRound?.status === 'active') {
      setError('You already have a round in progress — finish or abandon it first.');
      return;
    }
    const owner = userId ?? 'local-user';
    const myName =
      profile.data?.displayName ?? displayName ?? 'Me';

    const holes = tee?.holes ?? [];
    const holeData =
      holes.length > 0
        ? holes
        : Array.from({ length: 18 }, (_, i) => ({
            hole: i + 1,
            par: course.pars[i] ?? 4,
            yards: null,
            handicap: null,
            handicapWomen: null,
          }));

    const round = createRound({
      id: newId(),
      ownerId: owner ?? 'dev-preview',
      courseId: course.provider === 'manual' ? null : course.providerId,
      courseProvider: course.provider,
      courseProviderId: course.providerId,
      courseName: course.name,
      teeSetId: tee?.id ?? null,
      teeName: tee?.name ?? null,
      holesPlanned,
      startingHole: holesPlanned === 9 && course.holeCount === 18 ? startingHole : 1,
      format,
      isMultiDevice: false,
      shareCode: null,
      holeData,
      participants: [
        { userId: owner ?? null, displayName: myName, isGuest: false, teeLabel: tee?.name ?? null },
        ...guestNames.map((g) => ({
          userId: null,
          displayName: g,
          isGuest: true,
          teeLabel: tee?.name ?? null,
        })),
      ],
    });
    router.replace(`/round/active?hole=${round.startingHole}`);
  };

  return (
    <Screen scroll padded={false}>
      <Stack.Screen options={{ title: 'New round', headerBackTitle: 'Back' }} />
      <View style={styles.body}>
        {course ? (
          <Card style={styles.courseCard}>
            <Text variant="caption" secondary style={{ letterSpacing: 1 }}>
              COURSE
            </Text>
            <Text variant="h2">{course.name}</Text>
            <Text variant="caption" secondary>
              {[course.city, course.state].filter(Boolean).join(', ') || 'Manual course'}
              {tee ? ` · ${tee.name} tees` : ''}
            </Text>
          </Card>
        ) : courseQuery.isLoading ? (
          <Card>
            <Text variant="body" secondary>
              Loading course…
            </Text>
          </Card>
        ) : (
          <Card>
            <Text variant="body" secondary>
              Choose a course from the Play tab to start a round.
            </Text>
            <Button
              title="Find a course"
              variant="outline"
              onPress={() => router.replace('/(tabs)/play')}
            />
          </Card>
        )}

        {course ? (
          <>
            <SectionHeader title="Round" />
            <Text variant="label" secondary>
              Length
            </Text>
            <SegmentedControl
              options={[
                { value: '18', label: '18 holes' },
                { value: '9', label: '9 holes' },
              ]}
              value={String(holesPlanned)}
              onChange={(v) => setHolesPlanned(Number(v) as 9 | 18)}
            />
            {holesPlanned === 9 && course.holeCount === 18 ? (
              <>
                <Text variant="label" secondary>
                  Which nine?
                </Text>
                <SegmentedControl
                  options={[
                    { value: '1', label: 'Front (1–9)' },
                    { value: '10', label: 'Back (10–18)' },
                  ]}
                  value={String(startingHole)}
                  onChange={(v) => setStartingHole(Number(v) as 1 | 10)}
                />
              </>
            ) : null}

            <Text variant="label" secondary>
              Format
            </Text>
            <View style={styles.chipRow}>
              <Chip label="Stroke play" selected={format === 'stroke'} onPress={() => setFormat('stroke')} />
              <Chip label="Scramble" selected={format === 'scramble'} onPress={() => setFormat('scramble')} />
              <Chip label="Match play" selected={format === 'match'} onPress={() => setFormat('match')} />
            </View>

            {(course.teeSets?.length ?? 0) > 1 ? (
              <>
                <Text variant="label" secondary>
                  Tees
                </Text>
                <View style={styles.chipRow}>
                  {course.teeSets.map((t) => (
                    <Chip
                      key={t.id}
                      label={`${t.name}${t.totalYards ? ` · ${t.totalYards.toLocaleString()}y` : ''}`}
                      selected={tee?.id === t.id}
                      onPress={() => setTeeId(t.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <SectionHeader title="Players" />
            <Card>
              <View style={styles.playerRow}>
                <Text variant="bodyStrong">
                  {profile.data?.displayName ?? displayName ?? 'You'}
                </Text>
                <Text variant="caption" secondary>
                  You{tee ? ` · ${tee.name}` : ''}
                </Text>
              </View>
              {guestNames.map((g) => (
                <View key={g} style={styles.playerRow}>
                  <Text variant="bodyStrong">{g}</Text>
                  <Button
                    title=""
                    variant="ghost"
                    size="sm"
                    icon={<X size={16} color={colors.danger} />}
                    onPress={() => setGuestNames(guestNames.filter((n) => n !== g))}
                  />
                </View>
              ))}
              <View style={styles.addGuestRow}>
                <Input
                  value={newGuest}
                  onChangeText={setNewGuest}
                  placeholder="Add a guest (no account needed)"
                  style={{ flex: 1 }}
                  dense
                  onSubmitEditing={addGuest}
                  returnKeyType="done"
                />
                <Button
                  title=""
                  variant="outline"
                  size="sm"
                  icon={<Plus size={16} color={colors.forest} />}
                  onPress={addGuest}
                />
              </View>
              <Text variant="micro" secondary>
                Guests score on this device — no sign-up needed.
              </Text>
            </Card>

            {error ? (
              <Text variant="caption" style={{ color: colors.danger }}>
                {error}
              </Text>
            ) : null}

            <Button
              title={`Start ${holesPlanned === 9 ? '9-hole' : '18-hole'} round`}
              size="xl"
              fullWidth
              disabled={!course}
              onPress={start}
            />
            <View style={{ height: spacing.xxxl }} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  courseCard: { gap: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  addGuestRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
});
