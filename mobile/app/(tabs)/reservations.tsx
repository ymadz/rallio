import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

type TabType = 'upcoming' | 'past';

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'in_progress';
  court: {
    id: string;
    name: string;
    court_type: 'indoor' | 'outdoor';
    venue: {
      id: string;
      name: string;
      address: string;
    };
  };
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#FBBF24', dot: '#FBBF24' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', dot: '#10B981' },
  in_progress: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6', dot: '#8B5CF6' },
  completed: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280', dot: '#6B7280' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '#EF4444' },
};

export default function ReservationsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReservations();
    } else {
      setLoading(false);
    }
  }, [user, activeTab]);

  const fetchReservations = async () => {
    try {
      // Get player_id first
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (playerError || !playerData) {
        setReservations([]);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('reservations')
        .select(`
          id,
          reservation_date,
          start_time,
          end_time,
          duration_hours,
          total_amount,
          status,
          court:courts (
            id,
            name,
            court_type,
            venue:venues (
              id,
              name,
              address
            )
          )
        `)
        .eq('player_id', playerData.id);

      if (activeTab === 'upcoming') {
        query = query
          .gte('reservation_date', today)
          .in('status', ['pending', 'confirmed', 'in_progress'])
          .order('reservation_date', { ascending: true })
          .order('start_time', { ascending: true });
      } else {
        query = query
          .or(`reservation_date.lt.${today},status.eq.completed,status.eq.cancelled`)
          .order('reservation_date', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map data to match Reservation interface - handle nested Supabase relations
      const mappedReservations: Reservation[] = (data || []).map((item: any) => ({
        ...item,
        court: Array.isArray(item.court) ? {
          ...item.court[0],
          venue: Array.isArray(item.court[0]?.venue) ? item.court[0].venue[0] : item.court[0]?.venue
        } : {
          ...item.court,
          venue: Array.isArray(item.court?.venue) ? item.court.venue[0] : item.court?.venue
        }
      }));
      
      setReservations(mappedReservations);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReservations();
  }, [activeTab]);

  const handleCancelReservation = (reservation: Reservation) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reservations')
                .update({ status: 'cancelled' })
                .eq('id', reservation.id);

              if (error) throw error;
              fetchReservations();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
            }
          }
        },
      ]
    );
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const renderReservationCard = ({ item }: { item: Reservation }) => {
    const statusStyle = statusColors[item.status] || statusColors.pending;
    const canCancel = ['pending', 'confirmed'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/venue/${item.court.venue.id}`)}
        activeOpacity={0.8}
      >
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ')}
          </Text>
        </View>

        {/* Date & Time */}
        <View style={styles.dateTimeRow}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color="#8B5CF6" />
            <Text style={styles.dateText}>{formatDate(item.reservation_date)}</Text>
          </View>
          <View style={styles.timeContainer}>
            <Ionicons name="time-outline" size={16} color="#8B5CF6" />
            <Text style={styles.timeText}>
              {formatTime(item.start_time)} - {formatTime(item.end_time)}
            </Text>
          </View>
        </View>

        {/* Venue & Court Info */}
        <View style={styles.venueInfo}>
          <View style={styles.courtIcon}>
            <Ionicons name="tennisball" size={20} color="#8B5CF6" />
          </View>
          <View style={styles.venueDetails}>
            <Text style={styles.courtName}>{item.court.name}</Text>
            <Text style={styles.venueName}>{item.court.venue.name}</Text>
            <View style={styles.courtTypeBadge}>
              <Text style={styles.courtTypeText}>
                {item.court.court_type === 'indoor' ? '🏠 Indoor' : '☀️ Outdoor'}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>{item.duration_hours}hr</Text>
            <Text style={styles.priceAmount}>₱{item.total_amount}</Text>
          </View>
        </View>

        {/* Actions */}
        {canCancel && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelReservation(item)}
            >
              <Text style={styles.cancelButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0D0B1A', '#1A1625', '#0D0B1A']} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.authPrompt}>
              <View style={styles.authIconContainer}>
                <Ionicons name="calendar-outline" size={64} color="#4B5563" />
              </View>
              <Text style={styles.authTitle}>Sign In Required</Text>
              <Text style={styles.authSubtitle}>
                Sign in to view your bookings and reservation history
              </Text>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0D0B1A', '#1A1625', '#0D0B1A']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>My Bookings</Text>
            <Text style={styles.subtitle}>Your reservations and history</Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
              onPress={() => setActiveTab('upcoming')}
            >
              <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'past' && styles.tabActive]}
              onPress={() => setActiveTab('past')}
            >
              <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                Past
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          ) : reservations.length > 0 ? (
            <FlatList
              data={reservations}
              renderItem={renderReservationCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#8B5CF6"
                  colors={['#8B5CF6']}
                />
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons 
                  name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'} 
                  size={64} 
                  color="#4B5563" 
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'upcoming' 
                  ? 'Book a court to get started!' 
                  : 'Your completed bookings will appear here'
                }
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => router.push('/(tabs)')}
                >
                  <Text style={styles.bookButtonText}>Find Courts</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1A1625',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252038',
  },
  tabActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#1A1625',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#252038',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courtIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  venueDetails: {
    flex: 1,
  },
  courtName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  venueName: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  courtTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  courtTypeText: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#252038',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1625',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  bookButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
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
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
