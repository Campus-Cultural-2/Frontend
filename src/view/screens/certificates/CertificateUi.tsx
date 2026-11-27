import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppText as Text } from '@/components/ui/app-text';
import { AppBadge, AppButton, AppPageHeader, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';

export const CERTIFICATE_COLORS = {
  background: colors.surface.page,
  border: colors.border.default,
  ink: colors.text.heading,
  muted: '#717780',
  primary: colors.brand.primary,
  softYellow: '#FFF5C7',
  white: colors.neutral.white,
} as const;

export type NoticeTone = 'info' | 'warning' | 'success' | 'error';

export function CertificateScreenHeading({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      onBack?.();
    } else {
      router.replace('/(tabs)/(main)/certificados' as never);
    }
  };
  const leading = onBack ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={10}
      onPress={handleBack}
      style={appSurfaceStyles.iconButton}>
      <MaterialIcons name="arrow-back" size={20} color={CERTIFICATE_COLORS.ink} />
    </Pressable>
  ) : undefined;

  return <AppPageHeader title={title} subtitle={subtitle} leading={leading} />;
}

export function CertificateInfoBanner({
  title,
  message,
  tone = 'info',
}: {
  title: string;
  message: string;
  tone?: NoticeTone;
}) {
  const iconByTone: Record<NoticeTone, keyof typeof MaterialIcons.glyphMap> = {
    info: 'info-outline',
    warning: 'warning',
    success: 'check-circle-outline',
    error: 'error-outline',
  };
  const backgroundByTone: Record<NoticeTone, string> = {
    info: '#EAF2FA',
    warning: '#FFF1D1',
    success: '#E6F5EC',
    error: '#FDECEC',
  };
  const iconColorByTone: Record<NoticeTone, string> = {
    info: '#315E87',
    warning: '#9A6A10',
    success: '#278052',
    error: colors.status.danger,
  };

  return (
    <View style={[styles.banner, { backgroundColor: backgroundByTone[tone] }]}>
      <MaterialIcons name={iconByTone[tone]} size={19} color={iconColorByTone[tone]} />
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerMessage}>{message}</Text>
      </View>
    </View>
  );
}

export function CertificateStatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: NoticeTone | 'neutral';
}) {
  const variantByTone: Record<NoticeTone | 'neutral', 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
    info: 'info',
    warning: 'warning',
    success: 'success',
    error: 'danger',
    neutral: 'neutral',
  };

  return <AppBadge variant={variantByTone[tone]}>{label}</AppBadge>;
}

export function CertificatePrimaryButton({
  label,
  onPress,
  disabled = false,
  icon = 'arrow-forward',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <AppButton
      label={label}
      variant="primary"
      size="lg"
      disabled={disabled}
      icon={<MaterialIcons name={icon} size={18} color={colors.text.primary} />}
      onPress={onPress}
    />
  );
}

export function CertificateSecondaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <AppButton
      label={label}
      variant="outline"
      size="md"
      disabled={disabled}
      icon={icon ? <MaterialIcons name={icon} size={17} color={colors.text.heading} /> : undefined}
      onPress={onPress}
    />
  );
}

export function CertificateSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function getPersonInitials(name: string, lastName?: string | null) {
  const first = name.trim().charAt(0);
  const last = (lastName ?? '').trim().charAt(0);
  return `${first}${last}`.toLocaleUpperCase('pt-BR') || '?';
}

export function formatSubscriptionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'flex-start',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bannerCopy: { flex: 1, gap: 3 },
  bannerTitle: {
    color: CERTIFICATE_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  bannerMessage: {
    color: '#555D66',
    fontSize: 11,
    lineHeight: 17,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleCopy: { flex: 1, gap: 3 },
  sectionTitle: {
    color: CERTIFICATE_COLORS.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: CERTIFICATE_COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
  },
});
