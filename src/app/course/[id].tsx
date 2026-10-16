import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MapPin, Phone, Satellite } from 'lucide-react-native';

import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { useColors } from '@/theme/ThemeProvider';
import { spacing, tabularNums, } from '@/theme/theme';
import { getCourse, getGreenCenters } from '@/lib/api/courses';
import { useProfile } from '@/lib/hooks/data';
import { useAuthUser } from '@/lib/auth';
import { isClerkConfigured } from '@/lib/config';
import type { TeeSet } from '@/types/domain';

function TeeBlock({ tee, units }: { tee: TeeSet; units: 'yards' | 'meters' }) {
  useColors();
  const front = tee.holes.slice(0, 9);
  const back = tee.holes.slice(9, 18);
  const yd = (v: number | null) =>
    v == null ? '—' : units === 'meters' ? String(Math.round(v * 0.9144)) : String(v);

  const row = (label: string, cells: (string | number)[], bold = false) => (
    <View style={styles.grid} key={label}>
      <Text variant="caption" secondary style={[styles.gridLabel, bold && { fontWeight: '700' }]}>
        {label}
      </Text>
      {cells.map((c, i) => (
        <Text key={i} variant="caption" style={[styles.gridCell, tabularNums, bold && { fontWeight: '700' }]}>
          {c}
        </Text>
      ))}
    </View>
  );

  const total = (arr: typeof front, key: 'par' | 'yards') =>
    arr.reduce((n, h) => n + (h[key] ?? 0), 0);

  return (
    <View style={styles.teeBlock}>
      <View style={styles.teeHeader}>
        <Text variant="bodyStrong">{tee.name}</Text>
        <Text variant="caption" secondary>
          {tee.rating != null ? `Rating ${tee.rating}` : ''}
          {tee.slope != null ? ` · Slope ${tee.slope}` : ''}
          {tee.totalYards != null ? ` · ${tee.totalYards.toLocaleString()} yds` : ''}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {row('Hole', tee.holes.map((h) => h.hole), true)}
          {row('Par', tee.holes.map((h) => h.par))}
          {tee.holes.some((h) => h.yards != null)
            ? row(units === 'meters' ? 'Meters' : 'Yards', tee.holes.map((h) => yd(h.yards)))
            : null}
          {tee.holes.some((h) => h.handicap != null)
            ? row('Hdcp', tee.holes.map((h) => h.handicap ?? '—'))
            : null}
        </View>
      </ScrollView>
      <View style={styles.totalsRow}>
        <Text variant="caption" secondary>
          Par {total(tee.holes, 'par')}
          {front.length === 9 && back.length === 9
            ? ` · OUT ${total(front, 'par')} / IN ${total(back, 'par')}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

export default function CourseDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuthUser();
  const profile = useProfile(isClerkConfigured() ? userId : null);
  const units = profile.data?.units ?? 'yards';

  const providerId = decodeURIComponent(id ?? '');
  const course = useQuery({
    queryKey: ['course', providerId],
    queryFn: () => getCourse(providerId),
    enabled: !!providerId,
    staleTime: 10 * 60_000,
  });
  const greens = useQuery({
    queryKey: ['greens', providerId],
    queryFn: () => getGreenCenters(providerId),
    enabled: !!providerId && course.data?.greenCentersAvailable === true,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const c = course.data;

  return (
    <Screen scroll padded={false}>
      <Stack.Screen options={{ title: c?.name ?? 'Course', headerBackTitle: 'Back' }} />
      <View style={[styles.hero, { backgroundColor: colors.forest }]}>
        <Text variant="caption" style={{ color: colors.brass, letterSpacing: 2 }}>
          COURSE
        </Text>
        <Text variant="display" style={{ color: '#F7F4EC' }} numberOfLines={2}>
          {c?.name ?? (course.isLoading ? 'Loading…' : 'Course')}
        </Text>
        {c ? (
          <Text variant="body" style={{ color: '#C6D4CB' }}>
            {[c.city, c.state, c.country].filter(Boolean).join(', ')}
          </Text>
        ) : null}
        {course.error ? (
          <Text variant="body" style={{ color: '#E7B0A6' }}>
            Could not load course details — the provider may be rate-limited. You can still start a round with
            a manual scorecard.
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        {c ? (
          <>
            <View style={styles.metaRow}>
              {c.holeCount ? (
                <View style={styles.meta}>
                  <Text variant="h3">{c.holeCount}</Text>
                  <Text variant="caption" secondary>
                    holes
                  </Text>
                </View>
              ) : null}
              {c.latitude != null && c.longitude != null ? (
                <Pressable
                  style={styles.meta}
                  onPress={() =>
                    Linking.openURL(`https://maps.apple.com/?ll=${c.latitude},${c.longitude}&q=${encodeURIComponent(c.name)}`)
                  }
                >
                  <MapPin size={18} color={colors.forest} />
                  <Text variant="caption">Directions</Text>
                </Pressable>
              ) : null}
              {c.phone ? (
                <Pressable style={styles.meta} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                  <Phone size={18} color={colors.forest} />
                  <Text variant="caption">Call</Text>
                </Pressable>
              ) : null}
              {c.website ? (
                <Pressable style={styles.meta} onPress={() => Linking.openURL(c.website!)}>
                  <ExternalLink size={18} color={colors.forest} />
                  <Text variant="caption">Website</Text>
                </Pressable>
              ) : null}
            </View>

            <Card style={styles.gpsNote}>
              <View style={styles.gpsRow}>
                <Satellite size={16} color={colors.brass} />
                <Text variant="caption" secondary style={{ flex: 1 }}>
                  {greens.data?.available
                    ? 'Live GPS distance to the center of each green is enabled for this course.'
                    : 'Live GPS distances per hole are not published for this course. Yardages shown are the official tee-sheet numbers — labeled as such.'}
                </Text>
              </View>
            </Card>

            {c.teeSets.length > 0 ? (
              <>
                <SectionHeader title="Scorecard" />
                <Card>
                  {c.teeSets.map((tee, i) => (
                    <View key={tee.id}>
                      {i > 0 ? <Divider /> : null}
                      <TeeBlock tee={tee} units={units} />
                    </View>
                  ))}
                </Card>
              </>
            ) : (
              <Card>
                <Text variant="body" secondary>
                  No published scorecard for this course yet — you can enter pars and yardages yourself during
                  round setup.
                </Text>
              </Card>
            )}
          </>
        ) : null}

        <View style={styles.cta}>
          <Button
            title="Start a round here"
            size="xl"
            fullWidth
            disabled={!c}
            onPress={() => router.push({ pathname: '/round/setup', params: { courseId: providerId } })}
          />
        </View>
        <View style={{ height: spacing.xxxl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 64, paddingBottom: spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.xs },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  meta: { alignItems: 'center', gap: 4 },
  gpsNote: { marginBottom: spacing.lg },
  gpsRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  teeBlock: { paddingVertical: spacing.sm },
  teeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  grid: { flexDirection: 'row' },
  gridLabel: { width: 48 },
  gridCell: { width: 34, textAlign: 'center' },
  totalsRow: { marginTop: spacing.xs },
  cta: { marginTop: spacing.lg },
});
