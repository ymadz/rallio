import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Avatar } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';

export default function HomeScreen() {
  const { profile, player } = useAuthStore();

  const fullName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : 'Player';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{fullName} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Avatar source={profile?.avatar_url} name={fullName} size="md" />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/courts')}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.dark.primary + '20' }]}>
              <Ionicons name="tennisball" size={28} color={Colors.dark.primary} />
            </View>
            <Text style={styles.actionText}>Find Courts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/bookings')}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.dark.success + '20' }]}>
              <Ionicons name="calendar" size={28} color={Colors.dark.success} />
            </View>
            <Text style={styles.actionText}>My Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.dark.info + '20' }]}>
              <Ionicons name="people" size={28} color={Colors.dark.info} />
            </View>
            <Text style={styles.actionText}>Join Queue</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <Card variant="glass" padding="md" style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{player?.total_games_played || 0}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{player?.total_wins || 0}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{player?.skill_level || '-'}</Text>
              <Text style={styles.statLabel}>Skill</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{player?.rating || 1500}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </Card>

        {/* Nearby Courts Placeholder */}
        <Text style={styles.sectionTitle}>Courts Near You</Text>
        <Card variant="glass" padding="lg" style={styles.emptyCard}>
          <Ionicons name="location-outline" size={48} color={Colors.dark.textTertiary} />
          <Text style={styles.emptyTitle}>Enable Location</Text>
          <Text style={styles.emptyText}>
            Allow location access to see courts near you
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  greeting: {
    ...Typography.body,
    color: Colors.dark.textSecondary,
  },
  name: {
    ...Typography.h2,
    color: Colors.dark.text,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionText: {
    ...Typography.bodySmall,
    color: Colors.dark.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsCard: {
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...Typography.h2,
    color: Colors.dark.text,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.dark.border,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.dark.text,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
