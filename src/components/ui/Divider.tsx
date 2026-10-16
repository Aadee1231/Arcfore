import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { Text } from './Text';

export function Divider({ label }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      {label ? (
        <Text variant="caption" secondary style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  label: {},
});
