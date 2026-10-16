import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { Text } from './Text';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Standard screen wrapper — ivory background + safe-area aware. */
export function Screen({ children, scroll, padded = true, style, contentStyle }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top, paddingBottom: insets.bottom };
  if (scroll) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }, style]}>
        <ScrollView
          contentContainerStyle={[pad, padded && styles.padded, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <View
      style={[styles.root, pad, padded && styles.padded, { backgroundColor: colors.bg }, style]}
    >
      {children}
    </View>
  );
}

/** Editorial section header — small serif label with a hairline rule. */
export function SectionHeader({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.headerRow, style]}>
      <Text variant="h3">{title}</Text>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  useColors();
  return (
    <View style={styles.empty}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text variant="h3" center>
        {title}
      </Text>
      {message ? (
        <Text variant="body" secondary center style={styles.emptyMsg}>
          {message}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: { marginBottom: spacing.sm },
  emptyMsg: { maxWidth: 300 },
});
