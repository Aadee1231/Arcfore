import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing, } from '@/theme/theme';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
}

export function Chip({ label, selected, onPress, icon, small }: ChipProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.forest : colors.sage,
          paddingVertical: small ? spacing.xs : spacing.sm,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon}
      <Text
        variant={small ? 'caption' : 'label'}
        style={{ color: selected ? '#F7F4EC' : colors.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Horizontal single-select segment control — used for 9/18, tee selection, formats. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.segments, { backgroundColor: colors.sage }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              active && { backgroundColor: colors.bgRaised },
            ]}
          >
            <Text variant="label" style={{ color: active ? colors.text : colors.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
});
