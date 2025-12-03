import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';

interface PlayerStats {
  total_bookings: number;
  total_hours: number;
  total_spent: number;
}

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<PlayerStats>({
    total_bookings: 0,
    total_hours: 0,
    total_spent: 0,
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: playerData } = await supabase
        .from('players')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (!playerData) return;

      const { data: reservations } = await supabase
        .from('reservations')
        .select('duration_hours, total_amount, status')
        .eq('player_id', playerData.id)
        .eq('status', 'completed');

      if (reservations) {
        setStats({
          total_bookings: reservations.length,
          total_hours: reservations.reduce((sum, r) => sum + (r.duration_hours || 0), 0),
          total_spent: reservations.reduce((sum, r) => sum + (r.total_amount || 0), 0),
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'person-outline',
      label: 'Edit Profile',
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: 'stats-chart-outline',
      label: 'Player Stats',
      onPress: () => router.push('/profile/stats'),
    },
    {
      icon: 'heart-outline',
      label: 'Favorite Courts',
      onPress: () => router.push('/profile/favorites'),
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      onPress: () => router.push('/settings/notifications'),
    },
    {
      icon: 'settings-outline',
      label: 'Settings',
      onPress: () => router.push('/settings'),
    },
    {
      icon: 'help-circle-outline',
      label: 'Help & Support',
      onPress: () => router.push('/support'),
    },
  ];

  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0D0B1A', '#1A1625', '#0D0B1A']} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.authPrompt}>
              <View style={styles.authIconContainer}>
                <Ionicons name="person-outline" size={64} color="#4B5563" />
              </View>
              <Text style={styles.authTitle}>Sign In Required</Text>
              <Text style={styles.authSubtitle}>
                Sign in to view your profile and access all features
              </Text>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createAccountButton}
                onPress={() => router.push('/(auth)/signup')}
              >
                <Text style={styles.createAccountText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Player';
  const displayEmail = user?.email || '';
  const avatarUrl = profile?.avatar_url;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0D0B1A', '#1A1625', '#0D0B1A']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              {/* Avatar */}
              <TouchableOpacity style={styles.avatarContainer}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <LinearGradient
                    colors={['#8B5CF6', '#EC4899']}
                    style={styles.avatarGradient}
                  >
                    <Text style={styles.avatarText}>{initial}</Text>
                  </LinearGradient>
                )}
                <View style={styles.editAvatarButton}>
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* User Info */}
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userEmail}>{displayEmail}</Text>

              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="tennisball" size={14} color="#8B5CF6" />
                  <Text style={styles.badgeText}>Player</Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_bookings}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_hours}</Text>
                <Text style={styles.statLabel}>Hours</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>₱{stats.total_spent.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Spent</Text>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuContainer}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={item.onPress}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon} size={20} color="#8B5CF6" />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#4B5563" />
                </TouchableOpacity>
              ))}
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity style={styles.signOutMenuButton} onPress={handleSignOut}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.signOutMenuText}>Sign Out</Text>
            </TouchableOpacity>

            {/* App Version */}
            <Text style={styles.versionText}>Rallio v1.0.0</Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0D0B1A',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1625',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#252038',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#252038',
    marginVertical: 4,
  },
  menuContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#1A1625',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252038',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#252038',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  signOutMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  signOutMenuText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '500',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#4B5563',
    marginTop: 24,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  authIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1625',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createAccountButton: {
    paddingVertical: 12,
  },
  createAccountText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
});
