import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

type TabIconName = 'tennisball' | 'map' | 'calendar' | 'person';

function TabBarIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  const iconMap: Record<TabIconName, keyof typeof Ionicons.glyphMap> = {
    'tennisball': focused ? 'tennisball' : 'tennisball-outline',
    'map': focused ? 'map' : 'map-outline',
    'calendar': focused ? 'calendar' : 'calendar-outline',
    'person': focused ? 'person' : 'person-outline',
  };

  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
      <Ionicons name={iconMap[name]} size={24} color={color} />
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#0D0B1A',
          borderTopColor: '#252038',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#0D0B1A',
          borderBottomColor: '#252038',
          borderBottomWidth: 1,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Courts',
          tabBarLabel: 'Courts',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="tennisball" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="map" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'My Bookings',
          tabBarLabel: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="calendar" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 32,
  },
  iconContainerFocused: {
    // Optional: Add glow or scale effect
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8B5CF6',
  },
});
