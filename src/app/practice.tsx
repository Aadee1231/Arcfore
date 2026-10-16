import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Check, ChevronDown, ChevronUp, Target } from 'lucide-react-native';

import { EmptyState, Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import {
  useDrills,
  useLogPractice,
  useOneThing,
  usePracticeSessions,
  useResolveOneThing,
} from '@/lib/hooks/data';
import { DRILL_CATALOG } from '@/lib/drills';
import { isClerkConfigured } from '@/lib/config';
import type { PracticeDrill } from '@/types/domain';

const WEEK_MS = 7 * 24 * 3600 * 1000;

function completedDrillIdsThisWeek(sessions: { drillId: string; completedAt: string }[] | undefined) {
  const now = new Date().getTime();
  return new Set(
    (sessions ?? [])
      .filter((s) => now - new Date(s.completedAt).getTime() < WEEK_MS)
      .map((s) => s.drillId),
  );
}

export default function PracticeScreen() {
  const colors = useColors();
  useRouter();
  const { userId } = useAuth();
  const drills = useDrills();
  const sessions = usePracticeSessions(isClerkConfigured() ? userId : null);
  const oneThing = useOneThing(isClerkConfigured() ? userId : null);
  const log = useLogPractice(isClerkConfigured() ? userId : null);
  const resolve = useResolveOneThing(isClerkConfigured() ? userId : null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Prefer seeded DB drills; fall back to bundled catalog so the screen always works.
  const catalog: PracticeDrill[] = useMemo(() => {
    if (drills.data?.length) return drills.data;
    return DRILL_CATALOG.map((d, i) => ({ ...d, id: `local-${d.slug}` }));
  }, [drills.data]);

  const completedIds = useMemo(() => completedDrillIdsThisWeek(sessions.data), [sessions.data]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Practice', headerBackTitle: 'Back' }} />
      {oneThing.data ? (
        <Card dark style={styles.oneThing}>
          <View style={styles.oneThingHeader}>
            <Target size={14} color={colors.brass} />
            <Text variant="micro" style={{ color: colors.brass }}>
              YOUR ONE THING
            </Text>
          </View>
          <Text variant="h2" style={{ color: '#F7F4EC' }}>
            {oneThing.data.focus}
          </Text>
          <Text variant="body" style={{ color: '#C6D4CB' }}>
            {oneThing.data.explanation}
          </Text>
          {oneThing.data.drillName ? (
            <Text variant="bodyStrong" style={{ color: colors.brass }}>
              → {oneThing.data.drillName}
            </Text>
          ) : null}
          <View style={styles.oneThingActions}>
            <Button
              title="Mark improved"
              size="sm"
              variant="outline"
              onPress={() => resolve.mutate({ id: oneThing.data!.id, status: 'improved' })}
            />
            <Button
              title="Dismiss"
              size="sm"
              variant="ghost"
              onPress={() => resolve.mutate({ id: oneThing.data!.id, status: 'dismissed' })}
            />
          </View>
        </Card>
      ) : null}

      <FlatList
        data={catalog}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        ListHeaderComponent={
          <SectionHeader title="Drills" />
        }
        renderItem={({ item: d }) => {
          const open = expanded === d.id;
          const done = completedIds.has(d.id);
          return (
            <Card style={styles.drillCard} onPress={() => setExpanded(open ? null : d.id)}>
              <View style={styles.drillHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{d.name}</Text>
                  <Text variant="caption" secondary>
                    {d.skill} · {d.durationMinutes} min{d.equipment.length ? ` · ${d.equipment.join(', ')}` : ''}
                  </Text>
                </View>
                {done ? <Check size={16} color={colors.birdie} /> : open ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
              </View>
              {open ? (
                <View style={styles.drillBody}>
                  <Text variant="body" secondary>
                    {d.description}
                  </Text>
                  {d.steps.map((s, i) => (
                    <Text key={i} variant="body" secondary>
                      {i + 1}. {s}
                    </Text>
                  ))}
                  <Button
                    title={done ? 'Log again' : 'Mark practiced'}
                    variant={done ? 'outline' : 'primary'}
                    size="sm"
                    loading={log.isPending}
                    disabled={!isClerkConfigured() || d.id.startsWith('local-')}
                    onPress={() => log.mutate({ drillId: d.id, durationMinutes: d.durationMinutes })}
                  />
                  {d.id.startsWith('local-') ? (
                    <Text variant="micro" secondary>
                      Apply the Supabase migration to log practice history.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState title="No drills loaded" message="Drills appear once the catalog is seeded." />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  oneThing: { marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
  oneThingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  oneThingActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  drillCard: { marginBottom: spacing.sm },
  drillHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  drillBody: { marginTop: spacing.md, gap: spacing.sm },
});
