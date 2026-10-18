
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CertificatesScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <MaterialIcons
          name="card-membership"
          size={44}
          color="#D0A900"
        />

        <Text style={styles.title}>Certificados</Text>

        <Text style={styles.description}>
          Aqui você poderá consultar seus certificados e atividades
          concluídas no Campus Cultural.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Em desenvolvimento</Text>
          <Text style={styles.cardDescription}>
            Essa funcionalidade ainda está em desenvolvimento.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F3F4F4',
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#161616',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
  },
  description: {
    color: '#696969',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 28,
    padding: 20,
  },
  cardTitle: {
    color: '#161616',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    color: '#696969',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
});
