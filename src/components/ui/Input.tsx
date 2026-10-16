import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  leftIcon?: React.ReactNode;
  right?: React.ReactNode;
  /** Compact height for inline use (grids, toolbars). */
  dense?: boolean;
}

export function Input({ label, error, leftIcon, right, style, dense, ...rest }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" secondary style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          dense && { minHeight: 40 },
          { backgroundColor: colors.inputBg, borderColor: error ? colors.danger : colors.border },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, dense && { paddingVertical: spacing.xs }, { color: colors.text }, type.body, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" style={[styles.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  icon: { marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: spacing.md },
  error: { marginLeft: 2 },
});
