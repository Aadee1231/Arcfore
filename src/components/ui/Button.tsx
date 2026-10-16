import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/theme';
import { Text } from './Text';

type Variant = 'primary' | 'brass' | 'outline' | 'ghost' | 'danger' | 'sage';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  fullWidth,
  style,
  accessibilityLabel,
}: Props) {
  const colors = useColors();

  const bg: Record<Variant, string> = {
    primary: colors.forest,
    brass: colors.brass,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.danger,
    sage: colors.sage,
  };
  const fg: Record<Variant, string> = {
    primary: '#F7F4EC',
    brass: '#102E25',
    outline: colors.text,
    ghost: colors.textSecondary,
    danger: '#FDFCF8',
    sage: colors.text,
  };
  const heights: Record<Size, number> = { sm: 36, md: 48, lg: 56, xl: 64 };
  const pads: Record<Size, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl, xl: spacing.xl };
  const fonts: Record<Size, { fontFamily: string; fontSize: number; lineHeight: number }> = {
    sm: type.caption,
    md: type.label,
    lg: type.bodyStrong,
    xl: type.h3,
  };

  const handle = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading }}
      onPress={handle}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg[variant],
          height: heights[size],
          paddingHorizontal: pads[size],
          borderColor: variant === 'outline' ? colors.border : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        variant === 'outline' && styles.outline,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[fonts[size], { color: fg[variant] }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  outline: { borderWidth: 1.5 },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
