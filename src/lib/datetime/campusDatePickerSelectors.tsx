import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Pressable,
  StyleSheet,
} from 'react-native';
import type {
  CalendarMonthSelectorProps,
  CalendarYearSelectorProps,
} from 'react-native-ui-datepicker';

import { AppText as Text } from '@/components/ui/app-text';
import { colors } from '@/src/view/theme/tokens';

export function CampusMonthSelector({ text, isOpen, onPress }: CalendarMonthSelectorProps) {
  return (
    <Pressable
      accessibilityLabel={`Selecionar mês, ${text}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [selectorStyles.control, pressed ? selectorStyles.controlPressed : null]}>
      <Text style={selectorStyles.label}>{text}</Text>
      <MaterialIcons
        color={colors.text.secondary}
        name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
        size={22}
      />
    </Pressable>
  );
}

export function CampusYearSelector({ year, yearRange, isOpen, onPress }: CalendarYearSelectorProps) {
  const label = isOpen ? yearRange : year;

  return (
    <Pressable
      accessibilityLabel={`Selecionar ano, ${label}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [selectorStyles.control, pressed ? selectorStyles.controlPressed : null]}>
      <Text style={selectorStyles.label}>{label}</Text>
      <MaterialIcons
        color={colors.text.secondary}
        name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
        size={22}
      />
    </Pressable>
  );
}

const selectorStyles = StyleSheet.create({
  control: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  controlPressed: {
    opacity: 0.65,
  },
  label: {
    color: colors.text.heading,
    fontSize: 15,
    fontWeight: '800',
  },
});
