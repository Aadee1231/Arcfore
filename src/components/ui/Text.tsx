import React from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useColors } from '@/theme/ThemeProvider';
import { type as t } from '@/theme/theme';

type Variant = keyof typeof t;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  secondary?: boolean;
  inverse?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Text({
  variant = 'body',
  color,
  secondary,
  inverse,
  center,
  style,
  children,
  ...rest
}: Props) {
  const colors = useColors();
  const resolved =
    color ?? (inverse ? colors.textInverse : secondary ? colors.textSecondary : colors.text);
  return (
    <RNText
      {...rest}
      style={[t[variant] as TextStyle, { color: resolved }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </RNText>
  );
}
