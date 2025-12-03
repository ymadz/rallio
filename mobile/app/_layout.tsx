import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';

export default function RootLayout() {
  const loadSession = useAuthStore((state) => state.loadSession);

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="light" backgroundColor="#0D0B1A" />
        <Stack 
          screenOptions={{ 
            headerShown: false,
            contentStyle: { backgroundColor: '#0D0B1A' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="venue/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="booking/[courtId]" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        </Stack>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B1A',
  },
});
