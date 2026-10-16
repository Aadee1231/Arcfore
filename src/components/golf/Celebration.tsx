import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
 useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';

/**
 * Tasteful score celebration — a serif label ("Birdie") that rises and fades.
 * Eagle/albatross gets a brass ring pulse too. Respects reduced-motion.
 */
export function ScoreCelebration({
  name,
  onDone,
}: {
  name: 'Birdie' | 'Eagle' | 'Albatross' | 'Hole in one';
  onDone: () => void;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const translate = useSharedValue(8);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const big = name !== 'Birdie';

  useEffect(() => {
    void Haptics.notificationAsync(
      big ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    if (reduced) {
      opacity.value = 1;
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 220 }),
      withDelay(big ? 1200 : 900, withTiming(0, { duration: 300 })),
    );
    translate.value = withTiming(-14, { duration: 1600 });
    if (big) {
      ringScale.value = withTiming(1.5, { duration: 1100 });
      ringOpacity.value = withSequence(
        withTiming(0.8, { duration: 200 }),
        withTiming(0, { duration: 900 }),
      );
    }
    const t = setTimeout(() => runOnJS(onDone)(), big ? 1700 : 1300);
    return () => clearTimeout(t);
  }, [name, onDone, opacity, translate, ringScale, ringOpacity, reduced, big]);

  const textAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));
  const ringAnim = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.ring, { borderColor: colors.brass }, ringAnim]} />
      <Animated.View style={textAnim}>
        <Text variant="title" style={{ color: colors.brass }}>
          {name}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
});
