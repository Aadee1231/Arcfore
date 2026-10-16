import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  dark?: boolean;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, style, padded = true, dark, accessibilityLabel }: Props) {
  const colors = useColors();
  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: dark ? colors.forestMid : colors.bgRaised,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
  },
});
