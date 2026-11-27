import ProfileScreen from '@/src/view/screens/profile/ProfileScreen';
import { TabScreenTransition } from '@/components/navigation/tab-screen-transition';

export default function ProfileRoute() {
  return <TabScreenTransition><ProfileScreen /></TabScreenTransition>;
}
