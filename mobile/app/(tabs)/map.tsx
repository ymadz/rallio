import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, mapConfig } from '@/constants/config';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>
          Map integration will be added here with react-native-maps
        </Text>
        <Text style={styles.coords}>
          Default center: {mapConfig.defaultCenter.latitude.toFixed(4)},{' '}
          {mapConfig.defaultCenter.longitude.toFixed(4)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  coords: {
    fontSize: 12,
    color: colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
