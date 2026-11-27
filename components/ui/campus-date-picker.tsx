import {
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import DatePicker, { type DatePickerBaseProps, type DateType } from 'react-native-ui-datepicker';

import { useCampusDatePickerStyles } from '@/src/lib/datetime/campusDatePicker';
import { campusDatePickerComponents } from '@/src/lib/datetime/campusDatePickerComponents';

type CampusDatePickerProps = Omit<
  DatePickerBaseProps,
  'components' | 'mode' | 'navigationPosition' | 'onChange' | 'styles'
> & {
  date?: DateType;
  onChange?: (params: { date: DateType }) => void;
  style?: StyleProp<ViewStyle>;
};

export function CampusDatePicker({ style, ...props }: CampusDatePickerProps) {
  const styles = useCampusDatePickerStyles();

  return (
    <View style={style}>
      <DatePicker
        components={campusDatePickerComponents}
        mode="single"
        navigationPosition="around"
        styles={styles}
        {...props}
      />
    </View>
  );
}
