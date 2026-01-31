import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,

  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Avatar, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { useLocationStore, formatDistance } from '@/store/location-store';
import { useCourtStore, Venue } from '@/store/court-store';

export default function HomeScreen() {
  const { profile, player } = useAuthStore();
  const { location, permissionStatus, isLoading: locationLoading, requestPermission } = useLocationStore();
  const { venues, isLoading: venuesLoading, fetchVenues } = useCourtStore();
  const { calculateDistance } = useLocationStore();

  const fullName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : 'Player';

  // Fetch venues on mount
  useEffect(() => {
    fetchVenues();
  }, []);

  // Get nearby venues sorted by distance
  const nearbyVenues = useMemo(() => {
    if (!location || !venues.length) return [];

    return venues
      .map(venue => ({
        ...venue,
        distance: venue.latitude && venue.longitude
          ? calculateDistance(venue.latitude, venue.longitude)
          : null,
      }))
      .filter(v => v.distance !== null)
      .sort((a, b) => (a.distance || 999) - (b.distance || 999))
      .slice(0, 3);
  }, [location, venues, calculateDistance]);

  const handleEnableLocation = async () => {
    await requestPermission();
  };

  const hasLocation = permissionStatus === 'granted' && location;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
              <MaterialCommunityIcons name="badminton" size={28} color={Colors.dark.primary} />
            </View>
            <Text style={styles.actionText}>Find Courts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/bookings')}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.dark.success + '20' }]}>
              <Ionicons name="calendar" size={28} color={Colors.dark.success} />
            </View>
            <Text style={styles.actionText}>My Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/queue')}>
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

        {/* Nearby Courts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Courts Near You</Text>
          {hasLocation && nearbyVenues.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/courts')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {!hasLocation ? (
          <Card variant="glass" padding="lg" style={styles.emptyCard}>
            <Ionicons name="location-outline" size={48} color={Colors.dark.textTertiary} />
            <Text style={styles.emptyTitle}>Enable Location</Text>
            <Text style={styles.emptyText}>
              Allow location access to see courts near you
            </Text>
            <TouchableOpacity
              style={styles.enableButton}
              onPress={handleEnableLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator color={Colors.dark.text} size="small" />
              ) : (
                <>
                  <Ionicons name="navigate" size={18} color={Colors.dark.text} />
                  <Text style={styles.enableButtonText}>Enable Location</Text>
                </>
              )}
            </TouchableOpacity>
          </Card>
        ) : venuesLoading ? (
          <View style={styles.nearbyList}>
            {[1, 2, 3].map((_, i) => (
              <Card key={i} variant="default" padding="sm" style={styles.nearbyCard}>
                <View style={styles.nearbyCardContent}>
                  <Skeleton width={48} height={48} borderRadius={Radius.md} />
                  <View style={styles.nearbyInfo}>
                    <Skeleton width="70%" height={18} style={{ marginBottom: 4 }} />
                    <Skeleton width="50%" height={14} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : nearbyVenues.length === 0 ? (
          <Card variant="glass" padding="lg" style={styles.emptyCard}>
            <MaterialCommunityIcons name="badminton" size={48} color={Colors.dark.textTertiary} />
            <Text style={styles.emptyTitle}>No Courts Found</Text>
            <Text style={styles.emptyText}>
              No verified courts in your area yet
            </Text>
          </Card>
        ) : (
          <View style={styles.nearbyList}>
            {nearbyVenues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                onPress={() => router.push(`/courts/${venue.id}`)}
                activeOpacity={0.8}
              >
                <Card variant="default" padding="sm" style={styles.nearbyCard}>
                  <View style={styles.nearbyCardContent}>
                    <View style={styles.venueIconContainer}>
                      <MaterialCommunityIcons
                        name="badminton"
                        size={24}
                        color={Colors.dark.primary}
                      />
                    </View>
                    <View style={styles.nearbyInfo}>
                      <Text style={styles.nearbyName} numberOfLines={1}>
                        {venue.name}
                      </Text>
                      <View style={styles.nearbyMeta}>
                        <Ionicons name="location" size={14} color={Colors.dark.textSecondary} />
                        <Text style={styles.nearbyDistance}>
                          {formatDistance(venue.distance)}
                        </Text>
                        {venue.court_count && (
                          <>
                            <Text style={styles.nearbyDot}>•</Text>
                            <Text style={styles.nearbyCourts}>
                              {venue.court_count} court{venue.court_count !== 1 ? 's' : ''}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom padding for floating nav */}
        <View style={{ height: 100 }} />
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  seeAll: {
    ...Typography.body,
    color: Colors.dark.primary,
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
    marginBottom: Spacing.md,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  enableButtonText: {
    ...Typography.button,
    color: Colors.dark.text,
  },
  nearbyList: {
    gap: Spacing.sm,
  },
  nearbyCard: {
    marginBottom: 0,
  },
  nearbyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  venueIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyInfo: {
    flex: 1,
  },
  nearbyName: {
    ...Typography.body,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  nearbyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  nearbyDistance: {
    ...Typography.bodySmall,
    color: Colors.dark.textSecondary,
  },
  nearbyDot: {
    ...Typography.bodySmall,
    color: Colors.dark.textTertiary,
  },
  nearbyCourts: {
    ...Typography.bodySmall,
    color: Colors.dark.textSecondary,
  },
});
