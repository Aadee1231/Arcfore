import { useAuthUser } from '@/lib/auth';
import { Stack, useRouter } from 'expo-router';
import { Plus, Ruler, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { EmptyState, Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { recommendClub } from '@/lib/clubs/recommend';
import { useClubMutations, useClubs, useProfile } from '@/lib/hooks/data';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import type { UserClub } from '@/types/domain';

const TYPE_LABEL: Record<string, string> = {
  driver: 'Driver', wood: 'Wood', hybrid: 'Hybrid', iron: 'Iron', wedge: 'Wedge', putter: 'Putter', other: 'Other',
};

export default function BagScreen() {
  const colors = useColors();
  const router = useRouter();
  useAuthUser();
  const clubs = useClubs();
  const { remove } = useClubMutations();
  useProfile();

  const [target, setTarget] = useState('');
  const [risk, setRisk] = useState<'balanced' | 'conservative'>('balanced');
  const [rec, setRec] = useState<ReturnType<typeof recommendClub>>(null);

  const recommend = () => {
    const t = parseInt(target, 10);
    if (!t || !clubs.data) return;
    setRec(recommendClub(clubs.data, t, { preferConservative: risk === 'conservative' }));
  };

  const grouped = (clubs.data ?? []).reduce<Record<string, UserClub[]>>((acc, c) => {
    (acc[c.clubType] ??= []).push(c);
    return acc;
  }, {});
  const order = ['driver', 'wood', 'hybrid', 'iron', 'wedge', 'putter', 'other'];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'My bag', headerBackTitle: 'Back' }} />
      <View style={styles.header}>
        <Text variant="body" secondary>
          Record your real distances — the coach recommends clubs from these numbers, never tour distances.
        </Text>
        <Button
          title="Add a club"
          variant="outline"
          icon={<Plus size={16} color={colors.text} />}
          onPress={() => router.push('/bag/edit')}
        />
      </View>

      {/* Club recommendation */}
      <SectionHeader title="What should I hit?" />
      <Card>
        <View style={styles.recRow}>
          <Input
            value={target}
            onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, ''))}
            placeholder="Distance (yards)"
            keyboardType="number-pad"
            dense
            style={{ flex: 1 }}
            onSubmitEditing={recommend}
          />
          <Button title="Suggest" variant="primary" onPress={recommend} disabled={!target} />
        </View>
        <SegmentedControl
          options={[
            { value: 'balanced', label: 'Closest fit' },
            { value: 'conservative', label: 'Take enough club' },
          ]}
          value={risk}
          onChange={(v) => setRisk(v as 'balanced' | 'conservative')}
        />
        {rec ? (
          <View style={styles.recResult}>
            <Text variant="h3" style={{ color: colors.forest }}>
              {rec.club.name}
            </Text>
            <Text variant="body" secondary>
              {rec.explanation}
            </Text>
            {rec.estimated ? (
              <Text variant="micro" style={{ color: colors.brass }}>
                Based on limited data — refine this club's distance for better picks.
              </Text>
            ) : null}
            {rec.alternates.length > 0 ? (
              <Text variant="caption" secondary>
                Also: {rec.alternates.map((a) => `${a.club.name} (${a.difference > 0 ? '+' : ''}${a.difference}y)`).join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {rec === null && target && clubs.data?.length === 0 ? (
          <Text variant="caption" secondary>
            Add clubs with distances first — no recorded numbers, no suggestion.
          </Text>
        ) : null}
      </Card>

      <FlatList
        data={order.filter((t) => grouped[t]?.length)}
        keyExtractor={(t) => t}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        renderItem={({ item: type }) => (
          <View>
            <SectionHeader title={TYPE_LABEL[type] ?? type} />
            {grouped[type]!.map((c) => (
              <Card key={c.id} style={styles.clubCard} onPress={() => router.push({ pathname: '/bag/edit', params: { clubId: c.id } })}>
                <View style={styles.clubRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{c.name}</Text>
                    <Text variant="caption" secondary>
                      {[c.brand, c.model].filter(Boolean).join(' ') || '—'}
                      {c.confidence ? ` · ${c.confidence} confidence` : ''}
                    </Text>
                  </View>
                  <View style={styles.clubDist}>
                    <Text variant="number">{c.carryYards ?? '—'}</Text>
                    <Text variant="micro" secondary>
                      carry
                    </Text>
                  </View>
                  <View style={styles.clubDist}>
                    <Text variant="number">{c.totalYards ?? '—'}</Text>
                    <Text variant="micro" secondary>
                      total
                    </Text>
                  </View>
                  <Button
                    title=""
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={15} color={colors.danger} />}
                    onPress={() => remove.mutate(c.id)}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Card>
            <EmptyState
              icon={<Ruler size={26} color={colors.textSecondary} />}
              title="Empty bag"
              message="Add your clubs and real distances — even rough numbers make the coach smarter."
              action={<Button title="Add first club" onPress={() => router.push('/bag/edit')} />}
            />
          </Card>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
  recRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  recResult: { marginTop: spacing.md, gap: spacing.xs },
  clubCard: { marginBottom: spacing.sm },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  clubDist: { alignItems: 'center', minWidth: 40 },
});
