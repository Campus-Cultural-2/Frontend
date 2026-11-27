import HomeScreen from '@/src/view/screens/home/HomeScreen';
import { TabScreenTransition } from '@/components/navigation/tab-screen-transition';

export default function HomeRoute() {
  return <TabScreenTransition><HomeScreen /></TabScreenTransition>;
}
