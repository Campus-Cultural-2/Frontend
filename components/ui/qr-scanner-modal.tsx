import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type QrScannerModalProps = {
  onClose: () => void;
  onScanned: (code: string) => void;
  title: string;
  visible: boolean;
};

export function QrScannerModal({ onClose, onScanned, title, visible }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  // Evita processar o mesmo QR varias vezes enquanto a camera continua apontada.
  const handledRef = useRef(false);

  useEffect(() => {
    if (visible) {
      handledRef.current = false;
      if (permission && !permission.granted && permission.canAskAgain) {
        void requestPermission();
      }
    }
  }, [permission, requestPermission, visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        {permission?.granted ? (
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handledRef.current) {
                return;
              }

              handledRef.current = true;
              onScanned(data);
            }}
            style={styles.camera}
          />
        ) : (
          <View style={styles.camera}>
            <Text style={styles.message}>
              Permita o acesso à câmera nas configurações do aparelho para ler o QR code.
            </Text>
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>Fechar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#111111', flex: 1, gap: 16, padding: 16, paddingTop: 48 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  camera: { borderRadius: 12, flex: 1, justifyContent: 'center', overflow: 'hidden', padding: 16 },
  message: { color: '#FFFFFF', textAlign: 'center' },
  close: {
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    borderRadius: 6,
    height: 46,
    justifyContent: 'center',
  },
  closeText: { color: '#111111', fontWeight: '700' },
});
