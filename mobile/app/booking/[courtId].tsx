import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

const { width } = Dimensions.get('window');

interface TimeSlot {
  time: string;
  available: boolean;
  price: number;
}

interface Court {
  id: string;
  name: string;
  court_type: 'indoor' | 'outdoor';
  hourly_rate: number;
  venue_id: string;
}

interface Venue {
  id: string;
  name: string;
  opening_hours: any;
}

const HOURS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 6; // 6 AM to 9 PM
  return `${hour.toString().padStart(2, '0')}:00`;
});

export default function BookingScreen() {
  const { courtId, venueName, courtName } = useLocalSearchParams<{
    courtId: string;
    venueName: string;
    courtName: string;
  }>();
  
  const { user } = useAuthStore();
  const [court, setCourt] = useState<Court | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Booking state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  useEffect(() => {
    fetchCourtDetails();
  }, [courtId]);

  useEffect(() => {
    if (court) {
      fetchBookedSlots();
    }
  }, [court, selectedDate]);

  const fetchCourtDetails = async () => {
    try {
      const { data: courtData, error: courtError } = await supabase
        .from('courts')
        .select('*, venues(*)')
        .eq('id', courtId)
        .single();

      if (courtError) throw courtError;
      
      setCourt({
        id: courtData.id,
        name: courtData.name,
        court_type: courtData.court_type,
        hourly_rate: courtData.hourly_rate,
        venue_id: courtData.venue_id,
      });
      
      setVenue(courtData.venues);
    } catch (error) {
      console.error('Error fetching court:', error);
      Alert.alert('Error', 'Failed to load court details');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookedSlots = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('reservations')
        .select('start_time, end_time')
        .eq('court_id', courtId)
        .eq('reservation_date', dateStr)
        .in('status', ['pending', 'confirmed', 'in_progress']);

      if (error) throw error;

      // Convert reservations to booked slots
      const slots: string[] = [];
      data?.forEach(reservation => {
        const startHour = parseInt(reservation.start_time.split(':')[0]);
        const endHour = parseInt(reservation.end_time.split(':')[0]);
        for (let h = startHour; h < endHour; h++) {
          slots.push(`${h.toString().padStart(2, '0')}:00`);
        }
      });
      
      setBookedSlots(slots);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
    }
  };

  const toggleSlot = (time: string) => {
    if (bookedSlots.includes(time)) return;
    
    setSelectedSlots(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      return [...prev, time].sort();
    });
  };

  const isSlotSelectable = (time: string): boolean => {
    // Check if slot is in the past for today
    if (isToday(selectedDate)) {
      const now = new Date();
      const slotHour = parseInt(time.split(':')[0]);
      if (slotHour <= now.getHours()) return false;
    }
    return !bookedSlots.includes(time);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDateNum = (date: Date): string => {
    return date.getDate().toString();
  };

  const calculateTotal = (): number => {
    return selectedSlots.length * (court?.hourly_rate || 0);
  };

  const getTimeRange = (): string => {
    if (selectedSlots.length === 0) return 'Select time slots';
    const sorted = [...selectedSlots].sort();
    const startTime = sorted[0];
    const endHour = parseInt(sorted[sorted.length - 1].split(':')[0]) + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    return `${startTime} - ${endTime}`;
  };

  const handleBooking = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to make a booking', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (selectedSlots.length === 0) {
      Alert.alert('Select Time', 'Please select at least one time slot');
      return;
    }

    setSubmitting(true);

    try {
      const sorted = [...selectedSlots].sort();
      const startTime = sorted[0];
      const endHour = parseInt(sorted[sorted.length - 1].split(':')[0]) + 1;
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;
      const dateStr = selectedDate.toISOString().split('T')[0];

      // Get player_id
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (playerError || !playerData) {
        throw new Error('Player profile not found');
      }

      const { data, error } = await supabase
        .from('reservations')
        .insert({
          court_id: courtId,
          player_id: playerData.id,
          reservation_date: dateStr,
          start_time: startTime,
          end_time: endTime,
          duration_hours: selectedSlots.length,
          total_amount: calculateTotal(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23P01') {
          Alert.alert('Time Conflict', 'This time slot is no longer available. Please select another time.');
          fetchBookedSlots();
          return;
        }
        throw error;
      }

      // Navigate to payment
      router.push({
        pathname: '/payment/[reservationId]',
        params: { reservationId: data.id },
      });
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0D0B1A', '#1A1625']} style={styles.gradient}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient colors={['#0D0B1A', '#1A1625', '#0D0B1A']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Book Court</Text>
              <Text style={styles.headerSubtitle}>{venueName || venue?.name}</Text>
            </View>
            <View style={styles.headerPlaceholder} />
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Court Info Card */}
            <View style={styles.courtInfoCard}>
              <View style={styles.courtIcon}>
                <Ionicons name="tennisball" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.courtDetails}>
                <Text style={styles.courtName}>{courtName || court?.name}</Text>
                <View style={styles.courtMeta}>
                  <View style={[
                    styles.courtTypeBadge,
                    court?.court_type === 'indoor' ? styles.indoorBadge : styles.outdoorBadge
                  ]}>
                    <Text style={styles.courtTypeText}>
                      {court?.court_type === 'indoor' ? '🏠 Indoor' : '☀️ Outdoor'}
                    </Text>
                  </View>
                  <Text style={styles.courtPrice}>₱{court?.hourly_rate}/hr</Text>
                </View>
              </View>
            </View>

            {/* Date Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.datesContainer}
              >
                {dates.map((date, index) => {
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  const isDateToday = isToday(date);
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dateCard,
                        isSelected && styles.dateCardSelected,
                      ]}
                      onPress={() => {
                        setSelectedDate(date);
                        setSelectedSlots([]);
                      }}
                    >
                      <Text style={[
                        styles.dateDayName,
                        isSelected && styles.dateTextSelected
                      ]}>
                        {isDateToday ? 'Today' : getDayName(date)}
                      </Text>
                      <Text style={[
                        styles.dateNum,
                        isSelected && styles.dateTextSelected
                      ]}>
                        {getDateNum(date)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Time Slots */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Time</Text>
              <Text style={styles.sectionHint}>
                {formatDate(selectedDate)} • Tap to select multiple hours
              </Text>
              
              <View style={styles.timeSlotsGrid}>
                {HOURS.map((time) => {
                  const isBooked = bookedSlots.includes(time);
                  const isSelected = selectedSlots.includes(time);
                  const isSelectable = isSlotSelectable(time);
                  
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeSlot,
                        isBooked && styles.timeSlotBooked,
                        isSelected && styles.timeSlotSelected,
                        !isSelectable && !isBooked && styles.timeSlotPast,
                      ]}
                      onPress={() => isSelectable && toggleSlot(time)}
                      disabled={!isSelectable}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        isBooked && styles.timeSlotTextBooked,
                        isSelected && styles.timeSlotTextSelected,
                        !isSelectable && !isBooked && styles.timeSlotTextPast,
                      ]}>
                        {time}
                      </Text>
                      {isBooked && (
                        <Text style={styles.bookedLabel}>Booked</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendAvailable]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendSelected]} />
                <Text style={styles.legendText}>Selected</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendBooked]} />
                <Text style={styles.legendText}>Booked</Text>
              </View>
            </View>

            <View style={{ height: 140 }} />
          </ScrollView>

          {/* Bottom Summary */}
          <View style={styles.bottomBar}>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>
                {selectedSlots.length > 0 
                  ? `${selectedSlots.length} hour${selectedSlots.length > 1 ? 's' : ''}`
                  : 'No slots selected'
                }
              </Text>
              <Text style={styles.summaryTime}>{getTimeRange()}</Text>
            </View>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>₱{calculateTotal()}</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.bookButton,
                selectedSlots.length === 0 && styles.bookButtonDisabled
              ]}
              onPress={handleBooking}
              disabled={selectedSlots.length === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.bookButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#252038',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  courtInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#1A1625',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252038',
  },
  courtIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courtDetails: {
    flex: 1,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  courtMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  courtTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  indoorBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  outdoorBadge: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  courtTypeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  courtPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  datesContainer: {
    gap: 8,
  },
  dateCard: {
    width: 64,
    height: 72,
    backgroundColor: '#1A1625',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252038',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  dateCardSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  dateDayName: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  dateNum: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dateTextSelected: {
    color: '#FFFFFF',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    width: (width - 48 - 24) / 4, // 4 columns
    height: 52,
    backgroundColor: '#1A1625',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252038',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  timeSlotBooked: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  timeSlotPast: {
    backgroundColor: '#0D0B1A',
    borderColor: '#1A1625',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  timeSlotTextSelected: {
    color: '#FFFFFF',
  },
  timeSlotTextBooked: {
    color: '#EF4444',
  },
  timeSlotTextPast: {
    color: '#4B5563',
  },
  bookedLabel: {
    fontSize: 9,
    color: '#EF4444',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendAvailable: {
    backgroundColor: '#1A1625',
    borderWidth: 1,
    borderColor: '#252038',
  },
  legendSelected: {
    backgroundColor: '#8B5CF6',
  },
  legendBooked: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#1A1625',
    borderTopWidth: 1,
    borderTopColor: '#252038',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 2,
  },
  totalSection: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  totalLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bookButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
