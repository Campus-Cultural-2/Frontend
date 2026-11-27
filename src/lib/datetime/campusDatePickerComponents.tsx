import { colors } from '@/src/view/theme/tokens';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { CalendarComponents } from 'react-native-ui-datepicker';

import {
  CampusMonthSelector,
  CampusYearSelector,
} from '@/src/lib/datetime/campusDatePickerSelectors';

export const campusDatePickerComponents: CalendarComponents = {
  IconPrev: <MaterialIcons color={colors.text.heading} name="chevron-left" size={26} />,
  IconNext: <MaterialIcons color={colors.text.heading} name="chevron-right" size={26} />,
  MonthSelector: (props) => <CampusMonthSelector {...props} />,
  YearSelector: (props) => <CampusYearSelector {...props} />,
};
