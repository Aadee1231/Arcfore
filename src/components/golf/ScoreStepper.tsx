import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing, } from '@/theme/theme';
import { Text } from '@/components/ui/Text';

interface Props {
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  par?: number;
  label?: string;
  /** highlight good/bad score vs par using scorecard colors */
  colorize?: boolean;
}

const AnimatedText = Animated.createAnimatedComponent(Text);

/** One-hand-usable giant score stepper for the live round. */
export function ScoreStepper({
  value,
  onChange,
  min = 1,
  max = 15,
  par,
  label,
  colorize = true,
}: Props) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const current = value ?? par ?? 4;

  const bump = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, current + dir));
    if (next === value) return;
    scale.value = withSequence(withSpring(1.15, { damping: 8 }), withSpring(1, { damping: 10 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onChange(next);
  };

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const diff = value != null && par != null ? value - par : null;
  const valueColor =
    colorize && diff != null
      ? diff <= -1
        ? colors.birdie
        : diff >= 2
          ? colors.danger
          : colors.text
      : colors.text;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" secondary>
          {label}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease score"
          onPress={() => bump(-1)}
          disabled={current <= min}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.sage, opacity: current <= min ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          <Minus size={30} color={colors.text} strokeWidth={2.4} />
        </Pressable>
        <AnimatedText variant="score" style={[styles.value, { color: valueColor }, anim]}>
          {value ?? '–'}
        </AnimatedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase score"
          onPress={() => bump(1)}
          disabled={current >= max}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.forest, opacity: current >= max ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          <Plus size={30} color="#F7F4EC" strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  btn: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 88, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
