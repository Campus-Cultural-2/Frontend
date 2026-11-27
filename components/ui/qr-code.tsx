import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors } from '@/src/view/theme/tokens';

export function QrCode({ size = 200, value }: { size?: number; value: string }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: colors.neutral.white, padding: 12 }}>
      <QRCode backgroundColor={colors.neutral.white} color={colors.text.primary} size={size} value={value} />
    </View>
  );
}
