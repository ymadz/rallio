/**
 * Settings Screen
 * Includes theme toggle (Light/Dark mode) - CRITICAL FEATURE
 */

import React from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  Pressable,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores/authStore'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type SettingItem = {
  id: string
  title: string
  subtitle?: string
  icon: keyof typeof Ionicons.glyphMap
  type: 'toggle' | 'link' | 'action'
  value?: boolean
  onPress?: () => void
  onToggle?: (value: boolean) => void
}

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme()
  const { profile, signOut } = useAuthStore()

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const settings: SettingItem[] = [
    {
      id: 'theme',
      title: 'Dark Mode',
      subtitle: theme.mode === 'dark' ? 'Enabled' : 'Disabled',
      icon: 'moon',
      type: 'toggle',
      value: theme.mode === 'dark',
      onToggle: toggleTheme,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      icon: 'notifications',
      type: 'link',
      onPress: () => {
        // TODO: Navigate to notifications settings
        Alert.alert('Coming Soon', 'Notification settings will be available soon')
      },
    },
    {
      id: 'location',
      title: 'Location Services',
      subtitle: 'Manage location permissions',
      icon: 'location',
      type: 'link',
      onPress: () => {
        // TODO: Navigate to location settings
        Alert.alert('Coming Soon', 'Location settings will be available soon')
      },
    },
    {
      id: 'privacy',
      title: 'Privacy Settings',
      subtitle: 'Control your privacy preferences',
      icon: 'shield-checkmark',
      type: 'link',
      onPress: () => {
        // TODO: Navigate to privacy settings
        Alert.alert('Coming Soon', 'Privacy settings will be available soon')
      },
    },
    {
      id: 'terms',
      title: 'Terms of Service',
      icon: 'document-text',
      type: 'link',
      onPress: () => {
        // TODO: Navigate to terms
        Alert.alert('Coming Soon', 'Terms of Service will be available soon')
      },
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      icon: 'lock-closed',
      type: 'link',
      onPress: () => {
        // TODO: Navigate to privacy policy
        Alert.alert('Coming Soon', 'Privacy Policy will be available soon')
      },
    },
    {
      id: 'about',
      title: 'About Rallio',
      subtitle: 'Version 1.0.0',
      icon: 'information-circle',
      type: 'link',
      onPress: () => {
        Alert.alert(
          'About Rallio',
          'Rallio - Badminton Court Finder & Queue Management\n\nVersion 1.0.0\n\nMade with ❤️ in Zamboanga City'
        )
      },
    },
  ]

  const renderSettingItem = (item: SettingItem) => {
    return (
      <Pressable
        key={item.id}
        onPress={item.type === 'link' || item.type === 'action' ? item.onPress : undefined}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border.main }]}>
          <View style={styles.settingLeft}>
            <View
              style={[styles.iconContainer, { backgroundColor: theme.colors.primary.main + '20' }]}
            >
              <Ionicons name={item.icon} size={20} color={theme.colors.primary.main} />
            </View>
            <View style={styles.settingText}>
              <Text variant="body" color="primary" semibold>
                {item.title}
              </Text>
              {item.subtitle && (
                <Text variant="caption" color="secondary" style={styles.subtitle}>
                  {item.subtitle}
                </Text>
              )}
            </View>
          </View>

          {item.type === 'toggle' && (
            <Switch
              value={item.value}
              onValueChange={item.onToggle}
              trackColor={{
                false: theme.colors.border.main,
                true: theme.colors.primary.main,
              }}
              thumbColor="#FFFFFF"
            />
          )}

          {(item.type === 'link' || item.type === 'action') && (
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          )}
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text variant="h2" color="primary">
          Settings
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Profile Section */}
        <Card padding="md" style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.primary.main + '20', borderColor: theme.colors.primary.main },
              ]}
            >
              <Text variant="h2" style={{ color: theme.colors.primary.main }}>
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View>
              <Text variant="h3" color="primary">
                {profile?.full_name || 'User'}
              </Text>
              <Text variant="caption" color="secondary">
                {profile?.email}
              </Text>
            </View>
          </View>
          <Button
            title="Edit Profile"
            variant="outline"
            size="sm"
            onPress={() => router.push('/(tabs)/profile')}
          />
        </Card>

        {/* Settings List */}
        <Card padding="none" style={styles.settingsCard}>
          {settings.map(renderSettingItem)}
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />

        <View style={styles.footer}>
          <Text variant="caption" color="tertiary" center>
            Rallio © 2024
          </Text>
          <Text variant="caption" color="tertiary" center style={styles.footerSubtext}>
            Badminton Court Finder & Queue Management
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    marginBottom: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  settingsCard: {
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  signOutButton: {
    marginBottom: 24,
  },
  footer: {
    marginTop: 16,
  },
  footerSubtext: {
    marginTop: 4,
  },
})
