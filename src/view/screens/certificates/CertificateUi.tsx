import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const CERTIFICATE_COLORS = {
  background: '#F7F7F8',
  border: '#E7E8EA',
  ink: '#202124',
  muted: '#717780',
  primary: '#FFCC00',
  softYellow: '#FFF5C7',
  white: '#FFFFFF',
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
  return (
    <View style={styles.heading}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={10}
          onPress={onBack}
          style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={20} color={CERTIFICATE_COLORS.ink} />
        </Pressable>
      ) : null}
      <View style={styles.headingCopy}>
        <Text style={styles.headingTitle}>{title}</Text>
        <Text style={styles.headingSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
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
    error: '#B42318',
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
  const backgroundByTone: Record<NoticeTone | 'neutral', string> = {
    info: '#E4EFF9',
    warning: '#FFF0CE',
    success: '#E4F4EA',
    error: '#FCE8E8',
    neutral: '#ECEEF0',
  };
  const textColorByTone: Record<NoticeTone | 'neutral', string> = {
    info: '#315E87',
    warning: '#95610A',
    success: '#23784B',
    error: '#A42B2B',
    neutral: '#626A73',
  };

  return (
    <View style={[styles.statusPill, { backgroundColor: backgroundByTone[tone] }]}>
      <Text style={[styles.statusText, { color: textColorByTone[tone] }]}>{label}</Text>
    </View>
  );
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      <MaterialIcons name={icon} size={18} color="#111111" />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      {icon ? <MaterialIcons name={icon} size={17} color="#30343A" /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
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
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: CERTIFICATE_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headingCopy: {
    flex: 1,
  },
  headingTitle: {
    color: CERTIFICATE_COLORS.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headingSubtitle: {
    color: CERTIFICATE_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
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
    fontSize: 11,
    fontWeight: '900',
  },
  bannerMessage: {
    color: '#555D66',
    fontSize: 10,
    lineHeight: 15,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: CERTIFICATE_COLORS.primary,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C7C9CD',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  secondaryButtonText: {
    color: '#30343A',
    fontSize: 10,
    fontWeight: '800',
  },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.82 },
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
