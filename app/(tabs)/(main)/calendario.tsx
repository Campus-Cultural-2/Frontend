import CalendarScreen from '@/src/view/screens/calendar/CalendarScreen';
import { TabScreenTransition } from '@/components/navigation/tab-screen-transition';

export default function CalendarRoute() {
  return <TabScreenTransition><CalendarScreen /></TabScreenTransition>;
}
