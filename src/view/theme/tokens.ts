/**
 * Design tokens shared by the mobile app and the web build.
 * Keep institutional yellow as the primary brand color and use semantic
 * colors for feedback rather than introducing screen-specific variations.
 */
export const colors = {
  neutral: {
    white: '#FFFFFF',
  },
  brand: {
    primary: '#FFCC00',
    emphasis: '#8A6D00',
    soft: '#FFFBEA',
  },
  text: {
    primary: '#111111',
    heading: '#20242A',
    secondary: '#5F6670',
    muted: '#7B838C',
    inverse: '#FFFFFF',
  },
  surface: {
    page: '#F5F6F7',
    card: '#FFFFFF',
    subtle: '#F3F4F4',
    brandSoft: '#FFFBEA',
  },
  border: {
    default: '#E5E7E9',
    strong: '#D7DADF',
    focus: '#FFCC00',
  },
  status: {
    success: '#21834A',
    successSoft: '#E4F5EB',
    warning: '#A96D00',
    warningSoft: '#FFF4D7',
    danger: '#B42318',
    dangerStrong: '#F04438',
    dangerSoft: '#FDE9E7',
  },
} as const;

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

export const typography = {
  size: {
    xs: 11,
    sm: 12,
    body: 14,
    md: 16,
    lg: 18,
    xl: 22,
    pageTitle: 20,
    title: 28,
    display: 34,
    hero: 42,
  },
  lineHeight: {
    compact: 16,
    body: 20,
    relaxed: 24,
    title: 36,
    pageTitle: 26,
    display: 42,
    hero: 52,
  },
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
