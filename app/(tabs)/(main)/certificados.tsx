import CertificatesScreen from '@/src/view/screens/certificates/CertificatesScreen';
import { TabScreenTransition } from '@/components/navigation/tab-screen-transition';

export default function CertificatesRoute() {
  return <TabScreenTransition><CertificatesScreen /></TabScreenTransition>;
}
