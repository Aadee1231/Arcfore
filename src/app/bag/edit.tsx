import { useAuthUser } from '@/lib/auth';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip, SegmentedControl } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useClubMutations, useClubs } from '@/lib/hooks/data';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import type { ClubType } from '@/types/domain';

const TYPES: { value: ClubType; label: string }[] = [
  { value: 'driver', label: 'Driver' },
  { value: 'wood', label: 'Wood' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'iron', label: 'Iron' },
  { value: 'wedge', label: 'Wedge' },
  { value: 'putter', label: 'Putter' },
  { value: 'other', label: 'Other' },
];

export default function ClubEditScreen() {
  const colors = useColors();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();
  useAuthUser();
  const clubs = useClubs();
  const { upsert } = useClubMutations();
  const existing = clubs.data?.find((c) => c.id === clubId);

  const [clubType, setClubType] = useState<ClubType>(existing?.clubType ?? 'iron');
  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [model, setModel] = useState(existing?.model ?? '');
  const [carry, setCarry] = useState(existing?.carryYards?.toString() ?? '');
  const [total, setTotal] = useState(existing?.totalYards?.toString() ?? '');
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>(existing?.confidence ?? 'medium');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setError('Name the club — e.g. "7 iron" or "Driver".');
      return;
    }
    upsert.mutate(
      {
        id: existing?.id,
        clubType,
        name: name.trim(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        carryYards: carry ? parseInt(carry, 10) : null,
        totalYards: total ? parseInt(total, 10) : null,
        confidence,
        notes: notes.trim() || null,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: existing ? 'Edit club' : 'Add club', headerBackTitle: 'Back' }} />
      <View style={styles.form}>
        <Text variant="label" secondary>
          Type
        </Text>
        <View style={styles.chipRow}>
          {TYPES.map((t) => (
            <Chip key={t.value} label={t.label} selected={clubType === t.value} onPress={() => setClubType(t.value)} />
          ))}
        </View>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. 7 iron, 56° wedge" />
        <View style={styles.rowInputs}>
          <Input label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="Titleist" style={{ flex: 1 }} />
          <Input label="Model (optional)" value={model} onChangeText={setModel} placeholder="T200" style={{ flex: 1 }} />
        </View>
        <View style={styles.rowInputs}>
          <Input
            label="Carry (yds)"
            value={carry}
            onChangeText={(t) => setCarry(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="150"
            style={{ flex: 1 }}
          />
          <Input
            label="Total (yds)"
            value={total}
            onChangeText={(t) => setTotal(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="165"
            style={{ flex: 1 }}
          />
        </View>
        <Text variant="label" secondary>
          How sure are you of these numbers?
        </Text>
        <SegmentedControl
          options={[
            { value: 'low', label: 'Rough guess' },
            { value: 'medium', label: 'Decent idea' },
            { value: 'high', label: 'Measured' },
          ]}
          value={confidence}
          onChange={(v) => setConfidence(v as 'low' | 'medium' | 'high')}
        />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="New grip, tends to draw…" multiline />
        {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
        {upsert.error ? (
          <Text variant="caption" style={{ color: colors.danger }}>
            Couldn't save — check your connection.
          </Text>
        ) : null}
        <Button
          title={existing ? 'Save changes' : 'Add to bag'}
          size="lg"
          fullWidth
          loading={upsert.isPending}
          onPress={save}
        />
        <View style={{ height: spacing.xxxl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.lg, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowInputs: { flexDirection: 'row', gap: spacing.sm },
});
