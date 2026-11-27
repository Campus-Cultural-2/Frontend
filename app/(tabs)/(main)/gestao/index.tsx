import UserListScreen from '@/src/view/screens/users/UserListScreen';
import { TabScreenTransition } from '@/components/navigation/tab-screen-transition';

export default function ManagementRoute() {
  return <TabScreenTransition><UserListScreen /></TabScreenTransition>;
}
