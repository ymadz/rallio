import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/constants/config';

// Simple icon components since we don't have an icon library yet
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: Record<string, string> = {
    courts: '🏸',
    map: '🗺️',
    reservations: '📅',
    profile: '👤',
  };

  return (
    <View style={styles.iconContainer}>
      <View style={[styles.icon, focused && styles.iconFocused]}>
        <View style={styles.iconText}>
          {/* Text emoji as placeholder - replace with proper icons */}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Courts',
          tabBarLabel: 'Courts',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarLabel: 'Map',
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservations',
          tabBarLabel: 'Bookings',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFocused: {
    opacity: 1,
  },
  iconText: {
    fontSize: 20,
  },
});
