import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export function QrCode({ size = 200, value }: { size?: number; value: string }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12 }}>
      <QRCode backgroundColor="#FFFFFF" color="#111111" size={size} value={value} />
    </View>
  );
}
