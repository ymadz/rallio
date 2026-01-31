import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Make content extend behind tab bar
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="courts" />
      <Tabs.Screen name="queue" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="profile" />
      {/* Hide the template tabs */}

    </Tabs>
  );
}

