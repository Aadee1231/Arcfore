import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthUser } from '@/lib/auth';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/Chip';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { useProfile, useUpsertProfile } from '@/lib/hooks/data';
import { isClerkConfigured } from '@/lib/config';
import type { Handedness, SkillLevel } from '@/types/domain';

export default function EditProfileScreen() {
  useColors();
  const router = useRouter();
  const { userId } = useAuthUser();
  const profile = useProfile(isClerkConfigured() ? userId : null);
  const upsert = useUpsertProfile(isClerkConfigured() ? userId : null);

  const [name, setName] = useState('');
  const [handedness, setHandedness] = useState<Handedness>('right');
  const [skill, setSkill] = useState<SkillLevel>('intermediate');
  const [goal, setGoal] = useState('');
  const [typical, setTypical] = useState('');

  // Hydrate the form once the profile loads — adjust-during-render pattern.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (profile.data && hydratedFor !== profile.data.id) {
    setHydratedFor(profile.data.id);
    setName(profile.data.displayName);
    setHandedness(profile.data.handedness);
    setSkill(profile.data.skillLevel);
    setGoal(profile.data.primaryGoal);
    setTypical(profile.data.typicalScore?.toString() ?? '');
  }

  const save = () => {
    upsert.mutate(
      {
        displayName: name.trim() || 'Golfer',
        handedness,
        skillLevel: skill,
        primaryGoal: goal.trim(),
        typicalScore: typical ? parseInt(typical, 10) : null,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Edit profile', headerBackTitle: 'Back' }} />
      <View style={styles.form}>
        <Input label="Display name" value={name} onChangeText={setName} />
        <Text variant="label" secondary>Dominant hand</Text>
        <SegmentedControl
          options={[
            { value: 'right', label: 'Right' },
            { value: 'left', label: 'Left' },
          ]}
          value={handedness}
          onChange={setHandedness}
        />
        <Text variant="label" secondary>Skill level</Text>
        <SegmentedControl
          options={(['beginner', 'intermediate', 'advanced', 'scratch'] as SkillLevel[]).map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
          }))}
          value={skill}
          onChange={setSkill}
        />
        <Input label="Primary goal" value={goal} onChangeText={setGoal} placeholder="Break 90" />
        <Input
          label="Typical score / handicap (optional)"
          value={typical}
          onChangeText={(t) => setTypical(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />
        <Button title="Save" size="lg" fullWidth loading={upsert.isPending} onPress={save} />
        <View style={{ height: spacing.xxxl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.lg, gap: spacing.md },
});
