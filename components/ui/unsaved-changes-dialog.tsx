import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import {
  Platform,
  Modal,
  StyleSheet,
  View,
} from 'react-native';

import { AppText as Text } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';

type UnsavedChangesDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  message?: string;
  onCancel: () => void;
  onDiscard: () => void;
  title?: string;
  visible: boolean;
};

export function UnsavedChangesDialog({
  cancelLabel = 'Continuar editando',
  confirmLabel = 'Descartar e sair',
  message = 'As mudanças ainda não foram salvas. Se sair agora, elas serão perdidas.',
  onCancel,
  onDiscard,
  title = 'Descartar alterações?',
  visible,
}: UnsavedChangesDialogProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Animatable.View
          animation="zoomIn"
          duration={220}
          style={styles.dialog}
          useNativeDriver={Platform.OS !== 'web'}>
          <View style={styles.iconBox}>
            <MaterialIcons name="warning" size={22} color={colors.text.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <AppButton label={cancelLabel} variant="primary" size="lg" fullWidth onPress={onCancel} style={styles.dialogAction} />
          <AppButton label={confirmLabel} variant="outline" size="md" fullWidth onPress={onDiscard} style={styles.dialogActionSecondary} />
        </Animatable.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 17, 17, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    maxWidth: 360,
    padding: 22,
    width: '100%',
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.status.warningSoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 14,
    width: 44,
  },
  title: {
    color: colors.text.heading,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  dialogAction: { marginTop: 18 },
  dialogActionSecondary: { marginTop: 8 },
});
