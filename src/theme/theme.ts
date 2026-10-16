import { Platform } from 'react-native';

export const palette = {
  forest: '#102E25',
  forestMid: '#1B4436',
  forestDeep: '#0B211B',
  ivory: '#F7F4EC',
  ivoryDark: '#EFEAE0',
  surface: '#FDFCF8',
  sage: '#DDE6DA',
  sageDeep: '#C3D2BF',
  brass: '#C8A46B',
  brassDark: '#A9884F',
  ink: '#1E2522',
  muted: '#77817B',
  danger: '#A5453A',
  dangerSoft: '#F3E3E0',
  birdie: '#2E7D5B',
  line: '#E2DDd0',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: {
    bg: string;
    bgRaised: string;
    bgSunken: string;
    text: string;
    textSecondary: string;
    textInverse: string;
    accent: string;
    accentText: string;
    border: string;
    primary: string;
    primaryText: string;
    danger: string;
    dangerSoft: string;
    birdie: string;
    sage: string;
    brass: string;
    forest: string;
    forestMid: string;
    overlay: string;
    inputBg: string;
    tabBar: string;
  };
}

export const lightTheme: Theme = {
  scheme: 'light',
  colors: {
    bg: palette.ivory,
    bgRaised: palette.surface,
    bgSunken: palette.ivoryDark,
    text: palette.ink,
    textSecondary: palette.muted,
    textInverse: palette.ivory,
    accent: palette.forest,
    accentText: palette.ivory,
    border: palette.line,
    primary: palette.forest,
    primaryText: palette.ivory,
    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
    birdie: palette.birdie,
    sage: palette.sage,
    brass: palette.brass,
    forest: palette.forest,
    forestMid: palette.forestMid,
    overlay: 'rgba(16, 46, 37, 0.45)',
    inputBg: palette.surface,
    tabBar: palette.surface,
  },
};

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: {
    bg: palette.forestDeep,
    bgRaised: palette.forest,
    bgSunken: '#071812',
    text: palette.ivory,
    textSecondary: '#9AA69F',
    textInverse: palette.ink,
    accent: palette.brass,
    accentText: palette.forestDeep,
    border: '#2A4538',
    primary: palette.brass,
    primaryText: palette.forestDeep,
    danger: '#D08073',
    dangerSoft: '#3A2422',
    birdie: '#5FAE8C',
    sage: '#243B31',
    brass: palette.brass,
    forest: palette.forest,
    forestMid: palette.forestMid,
    overlay: 'rgba(0, 0, 0, 0.6)',
    inputBg: palette.forest,
    tabBar: palette.forest,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Font family names once fonts are loaded via expo-font. */
export const fonts = {
  serif: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
  serifRegular: 'Fraunces_500Medium',
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtraBold: 'PlusJakartaSans_800ExtraBold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

export const type = {
  display: { fontFamily: fonts.serifBold, fontSize: 44, lineHeight: 48 },
  title: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38 },
  h2: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  h3: { fontFamily: fonts.sansSemiBold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.sansSemiBold, fontSize: 10, lineHeight: 13, letterSpacing: 0.8 },
  score: { fontFamily: fonts.serifBold, fontSize: 56, lineHeight: 60 },
  number: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums' as const] },
  numberLg: { fontFamily: fonts.sansBold, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums' as const] },
} as const;

export const tabularNums = { fontVariant: ['tabular-nums' as const] } as const;
