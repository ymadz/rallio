import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D0B1A', '#1A1625', '#0D0B1A']}
          style={styles.gradient}
        >
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              style={styles.logoGradient}
            >
              <Ionicons name="tennisball" size={40} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.appName}>Rallio</Text>
          <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
        </LinearGradient>
      </View>
    );
  }

  if (isAuthenticated && user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});
