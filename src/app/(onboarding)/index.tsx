import { useAuthUser } from '@/lib/auth';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Flag } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip, SegmentedControl } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useUpsertProfile } from '@/lib/hooks/data';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/theme';
import type { Handedness, SkillLevel, Units } from '@/types/domain';

const GOALS = [
  'Break 100', 'Break 90', 'Break 80', 'Fix my slice', 'Better putting',
  'More distance', 'Consistency', 'Course management',
];

type Step = 'welcome' | 'skill' | 'goal' | 'details' | 'done';

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const { displayName: authName, email } = useAuthUser();

  const [step, setStep] = useState<Step>('welcome');
  const [displayName, setDisplayName] = useState(
    authName ?? email?.split('@')[0] ?? '',
  );
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');
  const [goal, setGoal] = useState('');
  const [handedness, setHandedness] = useState<Handedness>('right');
  const [units, setUnits] = useState<Units>('yards');
  const [typicalScore, setTypicalScore] = useState('');
  const [error, setError] = useState<string | null>(null);

  const steps: Step[] = useMemo(() => ['welcome', 'skill', 'goal', 'details'], []);
  const stepIndex = steps.indexOf(step);

  const upsert = useUpsertProfile();
  const save = useMutation({
    mutationFn: async () => {
      await upsert.mutateAsync({
        displayName: displayName?.trim() || 'Golfer',
        skillLevel,
        primaryGoal: goal,
        handedness,
        units,
        typicalScore: typicalScore ? parseInt(typicalScore, 10) : null,
        onboardedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => setStep('done'),
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save profile'),
  });

  const next = () => {
    if (step === 'welcome') setStep('skill');
    else if (step === 'skill') setStep('goal');
    else if (step === 'goal') setStep('details');
    else if (step === 'details') save.mutate();
  };
  const back = () => {
    if (step === 'skill') setStep('welcome');
    else if (step === 'goal') setStep('skill');
    else if (step === 'details') setStep('goal');
  };

  if (step === 'done') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <Animated.View entering={FadeIn.duration(600)} style={styles.doneMark}>
            <Flag size={40} color={colors.brass} />
          </Animated.View>
          <Text variant="display" center style={{ color: colors.forest }}>
            Welcome to{'\n'}Arcfore
          </Text>
          <Text variant="body" secondary center style={styles.doneMsg}>
            Your profile is set. Play a round, analyze your swing, and let your coach do the rest.
          </Text>
          <Button title="Start exploring" size="lg" onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.progress}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[
              styles.dot,
              { backgroundColor: i <= stepIndex ? colors.forest : colors.sage },
            ]}
          />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={SlideInRight.duration(280)} style={styles.stepWrap}>
          {step === 'welcome' && (
            <>
              <Text variant="display" style={{ color: colors.forest }}>
                Hello{','}
              </Text>
              <Text variant="body" secondary>
                A few quick questions so Arcfore knows your game. Everything can be changed later.
              </Text>
              <Input
                label="What should we call you?"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="First name"
                autoComplete="given-name"
              />
            </>
          )}
          {step === 'skill' && (
            <>
              <Text variant="title" style={{ color: colors.forest }}>
                How would you describe your game?
              </Text>
              <View style={styles.chipWrap}>
                {(['beginner', 'intermediate', 'advanced', 'scratch'] as SkillLevel[]).map((s) => (
                  <Chip
                    key={s}
                    label={s[0].toUpperCase() + s.slice(1)}
                    selected={skillLevel === s}
                    onPress={() => setSkillLevel(s)}
                  />
                ))}
              </View>
            </>
          )}
          {step === 'goal' && (
            <>
              <Text variant="title" style={{ color: colors.forest }}>
                What are you working toward?
              </Text>
              <View style={styles.chipWrap}>
                {GOALS.map((g) => (
                  <Chip key={g} label={g} selected={goal === g} onPress={() => setGoal(g)} />
                ))}
              </View>
            </>
          )}
          {step === 'details' && (
            <>
              <Text variant="title" style={{ color: colors.forest }}>
                Last details — all optional.
              </Text>
              <Text variant="label">Dominant hand</Text>
              <SegmentedControl
                options={[
                  { value: 'right', label: 'Right-handed' },
                  { value: 'left', label: 'Left-handed' },
                ]}
                value={handedness}
                onChange={setHandedness}
              />
              <Text variant="label">Units</Text>
              <SegmentedControl
                options={[
                  { value: 'yards', label: 'Yards' },
                  { value: 'meters', label: 'Meters' },
                ]}
                value={units}
                onChange={setUnits}
              />
              <Input
                label="Typical score or handicap (optional)"
                value={typicalScore}
                onChangeText={setTypicalScore}
                keyboardType="number-pad"
                placeholder="e.g. 95"
              />
            </>
          )}
          {error ? (
            <Text variant="caption" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        {step !== 'welcome' ? (
          <Button title="Back" variant="ghost" onPress={back} />
        ) : (
          <View />
        )}
        <Button
          title={step === 'details' ? 'Finish' : 'Continue'}
          size="lg"
          loading={save.isPending}
          disabled={step === 'welcome' && !displayName.trim()}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  progress: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  dot: { height: 4, flex: 1, borderRadius: radius.full },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  stepWrap: { gap: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  doneMark: { marginBottom: spacing.sm },
  doneMsg: { maxWidth: 320 },
});
