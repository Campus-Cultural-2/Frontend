import { useCallback, useEffect, type ReactNode } from 'react';
import { useNavigation } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  Platform,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, radii, spacing, typography } from '@/src/view/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';
type CardVariant = 'default' | 'outlined' | 'subtle' | 'elevated';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  /** Makes this button share available row width equally with sibling buttons. */
  equalWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/** Shared action button. Use variants instead of defining one-off button colors. */
export function AppButton({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  equalWidth = false,
  disabled,
  style,
  textStyle,
  ...pressableProps
}: AppButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const iconColor = variant === 'primary' ? colors.text.primary :
    variant === 'danger' ? colors.status.danger : colors.text.heading;

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? 'button'}
      accessibilityState={{ ...pressableProps.accessibilityState, disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        buttonSizeStyles[size],
        buttonVariantStyles[variant],
        fullWidth && styles.buttonFullWidth,
        equalWidth && styles.buttonEqualWidth,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}>
      {iconPosition === 'left' && !loading && icon ? icon : null}
      {loading ? <ActivityIndicator size="small" color={iconColor} /> : null}
      <AppText style={[styles.buttonText, buttonTextSizeStyles[size], buttonTextVariantStyles[variant], textStyle]}>
        {label}
      </AppText>
      {iconPosition === 'right' && !loading && icon ? icon : null}
    </Pressable>
  );
}

/** Shared compact filter/selector chip used across list and management screens. */
export function AppFilterChip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.filterChipPressed,
        style,
      ]}
    >
      <AppText style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
        {label}
      </AppText>
    </Pressable>
  );
}

type AppCardProps = ViewProps & {
  variant?: CardVariant;
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Standard content surface for cards, sections and grouped information. */
export function AppCard({
  children,
  variant = 'default',
  padding = spacing.md,
  radius = radii.lg,
  style,
  ...viewProps
}: AppCardProps) {
  return (
    <View
      {...viewProps}
      style={[
        styles.card,
        cardVariantStyles[variant],
        { padding, borderRadius: radius },
        style,
      ]}>
      {children}
    </View>
  );
}

type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function AppBadge({
  children,
  variant = 'neutral',
  style,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, badgeVariantStyles[variant], style]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <AppText style={[styles.badgeText, badgeTextVariantStyles[variant]]}>{children}</AppText>
      ) : children}
    </View>
  );
}

export function AppPageHeader({
  title,
  subtitle,
  leading,
  action,
  style,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const navigation = useNavigation();
  const clearWebFocus = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
    }
  }, []);

  useEffect(() => {
    const removeBlurListener = navigation.addListener('blur', clearWebFocus);
    const removeBeforeRemoveListener = navigation.addListener('beforeRemove', clearWebFocus);
    return () => {
      removeBlurListener();
      removeBeforeRemoveListener();
    };
  }, [clearWebFocus, navigation]);

  return (
    <View style={[styles.pageHeader, style]}>
      {leading ? <View style={styles.pageHeaderLeading}>{leading}</View> : <View style={styles.pageHeaderLeadingPlaceholder} />}
      <View style={styles.pageHeaderCopy}>
        <AppText numberOfLines={2} ellipsizeMode="tail" style={styles.pageHeaderTitle}>{title}</AppText>
        {subtitle ? <AppText numberOfLines={1} ellipsizeMode="tail" style={styles.pageHeaderSubtitle}>{subtitle}</AppText> : null}
      </View>
      {action ? <View style={styles.pageHeaderAction}>{action}</View> : <View style={styles.pageHeaderActionPlaceholder} />}
    </View>
  );
}

export function AppFieldLabel({
  label,
  required = false,
  helper,
  style,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fieldLabelGroup, style]}>
      <AppText style={styles.fieldLabel}>
        {label}{required ? <AppText style={styles.requiredMark}> *</AppText> : null}
      </AppText>
      {helper ? <AppText style={styles.fieldHelper}>{helper}</AppText> : null}
    </View>
  );
}

export function AppEmptyState({
  title,
  description,
  icon,
  action,
  style,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.emptyState, style]}>
      {icon ? <View style={styles.emptyStateIcon}>{icon}</View> : null}
      <AppText style={styles.emptyStateTitle}>{title}</AppText>
      {description ? <AppText style={styles.emptyStateDescription}>{description}</AppText> : null}
      {action ? <View style={styles.emptyStateAction}>{action}</View> : null}
    </View>
  );
}

/** Centered content width for web while retaining full-width mobile layouts. */
export function AppPageContent({
  children,
  style,
  maxWidth = 1120,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}) {
  return <View style={[styles.pageContent, { maxWidth }, style]}>{children}</View>;
}

export const appSurfaceStyles = StyleSheet.create({
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  filterChipSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary },
  filterChipPressed: { opacity: 0.76 },
  filterChipText: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: '500' },
  filterChipTextSelected: { color: colors.text.primary, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.lg,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radii.md,
    color: colors.text.primary,
    fontSize: typography.size.body,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
  },
});

export const appLayoutStyles = StyleSheet.create({
  authContent: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.surface.page,
  },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  button_sm: { minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radii.sm },
  button_md: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.md },
  button_lg: { minHeight: 50, paddingHorizontal: spacing.lg, borderRadius: radii.md },
  button_primary: { backgroundColor: colors.brand.primary, borderWidth: 1, borderColor: colors.brand.primary },
  button_secondary: { backgroundColor: colors.surface.subtle, borderWidth: 1, borderColor: colors.surface.subtle },
  button_outline: { backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.border.strong },
  button_danger: { backgroundColor: colors.status.dangerSoft, borderWidth: 1, borderColor: '#F6CFCC' },
  button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent' },
  buttonFullWidth: { alignSelf: 'stretch', width: '100%' },
  buttonEqualWidth: { alignSelf: 'stretch', flex: 1, minWidth: 0 },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.78 },
  buttonText: { fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  buttonText_sm: { fontSize: typography.size.sm, lineHeight: 18 },
  buttonText_md: { fontSize: typography.size.body, lineHeight: 20 },
  buttonText_lg: { fontSize: typography.size.md, lineHeight: 22 },
  buttonText_primary: { color: colors.text.primary },
  buttonText_secondary: { color: colors.text.heading },
  buttonText_outline: { color: colors.text.heading },
  buttonText_danger: { color: colors.status.danger },
  buttonText_ghost: { color: colors.text.secondary },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  filterChipSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary },
  filterChipPressed: { opacity: 0.76 },
  filterChipText: { color: colors.text.secondary, fontSize: typography.size.sm, fontWeight: '500' },
  filterChipTextSelected: { color: colors.text.primary, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  card_default: {},
  card_outlined: { backgroundColor: colors.surface.card, borderColor: colors.border.strong },
  card_subtle: { backgroundColor: colors.surface.subtle, borderColor: colors.surface.subtle },
  card_elevated: {
    boxShadow: '0px 3px 10px rgba(17, 24, 39, 0.06)',
    elevation: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badge_brand: { backgroundColor: colors.brand.soft },
  badge_success: { backgroundColor: colors.status.successSoft },
  badge_warning: { backgroundColor: colors.status.warningSoft },
  badge_danger: { backgroundColor: colors.status.dangerSoft },
  badge_info: { backgroundColor: '#EAF2FA' },
  badge_neutral: { backgroundColor: '#ECEEF0' },
  badgeText: { fontSize: typography.size.xs, lineHeight: typography.lineHeight.compact, fontWeight: '700' },
  badgeText_brand: { color: colors.brand.emphasis },
  badgeText_success: { color: colors.status.success },
  badgeText_warning: { color: colors.status.warning },
  badgeText_danger: { color: colors.status.danger },
  badgeText_info: { color: '#315E87' },
  badgeText_neutral: { color: colors.text.secondary },
  pageHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    marginBottom: spacing.md,
    position: 'relative',
    width: '100%',
  },
  pageHeaderLeading: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 12,
    width: 40,
    zIndex: 1,
  },
  pageHeaderLeadingPlaceholder: { height: 40, width: 40, position: 'absolute', left: 0, top: 12 },
  pageHeaderCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 48,
    width: '100%',
  },
  pageHeaderTitle: {
    color: colors.text.heading,
    fontSize: typography.size.pageTitle,
    fontWeight: '600',
    lineHeight: typography.lineHeight.pageTitle,
    letterSpacing: -0.25,
    textAlign: 'center',
    width: '100%',
  },
  pageHeaderSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: '400',
    lineHeight: typography.lineHeight.compact,
    textAlign: 'center',
    width: '100%',
  },
  pageHeaderAction: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 12,
    width: 40,
    zIndex: 1,
  },
  pageHeaderActionPlaceholder: { height: 40, width: 40, position: 'absolute', right: 0, top: 12 },
  fieldLabelGroup: { gap: 4 },
  fieldLabel: {
    color: colors.text.heading,
    fontSize: typography.size.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  requiredMark: { color: colors.status.danger, fontWeight: '700' },
  fieldHelper: { color: colors.text.muted, fontSize: typography.size.xs, lineHeight: 16 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyStateIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.subtle,
    marginBottom: spacing.xs,
  },
  emptyStateTitle: { color: colors.text.heading, fontSize: typography.size.md, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  emptyStateDescription: { color: colors.text.secondary, fontSize: typography.size.sm, lineHeight: 19, textAlign: 'center' },
  emptyStateAction: { marginTop: spacing.sm },
  pageContent: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
  },
});

const cardVariantStyles: Record<CardVariant, ViewStyle> = {
  default: styles.card_default,
  outlined: styles.card_outlined,
  subtle: styles.card_subtle,
  elevated: styles.card_elevated,
};
const buttonSizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: styles.button_sm,
  md: styles.button_md,
  lg: styles.button_lg,
};
const buttonVariantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: styles.button_primary,
  secondary: styles.button_secondary,
  outline: styles.button_outline,
  danger: styles.button_danger,
  ghost: styles.button_ghost,
};
const buttonTextSizeStyles: Record<ButtonSize, TextStyle> = {
  sm: styles.buttonText_sm,
  md: styles.buttonText_md,
  lg: styles.buttonText_lg,
};
const buttonTextVariantStyles: Record<ButtonVariant, TextStyle> = {
  primary: styles.buttonText_primary,
  secondary: styles.buttonText_secondary,
  outline: styles.buttonText_outline,
  danger: styles.buttonText_danger,
  ghost: styles.buttonText_ghost,
};
const badgeVariantStyles: Record<BadgeVariant, ViewStyle> = {
  brand: styles.badge_brand,
  success: styles.badge_success,
  warning: styles.badge_warning,
  danger: styles.badge_danger,
  info: styles.badge_info,
  neutral: styles.badge_neutral,
};
const badgeTextVariantStyles: Record<BadgeVariant, TextStyle> = {
  brand: styles.badgeText_brand,
  success: styles.badgeText_success,
  warning: styles.badgeText_warning,
  danger: styles.badgeText_danger,
  info: styles.badgeText_info,
  neutral: styles.badgeText_neutral,
};
