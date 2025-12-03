import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/services/supabase';

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  total_amount: number;
  status: string;
  court: {
    name: string;
    court_type: string;
    hourly_rate: number;
    venue: {
      name: string;
      address: string;
    };
  };
}

type PaymentMethod = 'gcash' | 'grab_pay' | 'paymaya';

export default function PaymentScreen() {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('gcash');

  useEffect(() => {
    fetchReservation();
  }, [reservationId]);

  const fetchReservation = async () => {
    try {
      const { data, error } = await supabase
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
            name,
            court_type,
            hourly_rate,
            venue:venues (
              name,
              address
            )
          )
        `)
        .eq('id', reservationId)
        .single();

      if (error) throw error;
      
      // Map Supabase response to Reservation type
      if (data) {
        const courtData = Array.isArray(data.court) ? data.court[0] : data.court;
        const venueData = courtData?.venue 
          ? (Array.isArray(courtData.venue) ? courtData.venue[0] : courtData.venue)
          : null;
        
        const mappedReservation: Reservation = {
          id: data.id,
          reservation_date: data.reservation_date,
          start_time: data.start_time,
          end_time: data.end_time,
          duration_hours: data.duration_hours,
          total_amount: data.total_amount,
          status: data.status,
          court: {
            name: courtData?.name || '',
            court_type: courtData?.court_type || '',
            hourly_rate: courtData?.hourly_rate || 0,
            venue: {
              name: venueData?.name || '',
              address: venueData?.address || '',
            },
          },
        };
        setReservation(mappedReservation);
      }
    } catch (error) {
      console.error('Error fetching reservation:', error);
      Alert.alert('Error', 'Failed to load reservation details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!reservation) return;

    setProcessing(true);
    try {
      // Call your payment API endpoint
      // For now, we'll simulate the payment process
      
      // In production, you'd call your backend to create a PayMongo source
      // and get the checkout URL
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/payments/create-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: reservation.id,
          amount: reservation.total_amount,
          paymentMethod: selectedMethod,
        }),
      });

      if (!response.ok) {
        // For demo purposes, we'll just update the status directly
        // In production, this would be handled by webhooks
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ status: 'confirmed' })
          .eq('id', reservation.id);

        if (updateError) throw updateError;

        Alert.alert(
          'Booking Confirmed!',
          'Your court has been reserved successfully.',
          [
            {
              text: 'View Bookings',
              onPress: () => router.replace('/(tabs)/reservations'),
            },
          ]
        );
        return;
      }

      const data = await response.json();
      
      // Open the payment URL
      if (data.checkoutUrl) {
        await Linking.openURL(data.checkoutUrl);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // For demo, just confirm the booking
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservation.id);

      if (!updateError) {
        Alert.alert(
          'Booking Confirmed!',
          'Your court has been reserved successfully.',
          [
            {
              text: 'View Bookings',
              onPress: () => router.replace('/(tabs)/reservations'),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to process payment. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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

  const paymentMethods = [
    { id: 'gcash', name: 'GCash', icon: '💳', color: '#007DFE' },
    { id: 'grab_pay', name: 'GrabPay', icon: '🟢', color: '#00B14F' },
    { id: 'paymaya', name: 'Maya', icon: '💚', color: '#52B788' },
  ] as const;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0D0B1A', '#1A1625']} style={styles.gradient}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </LinearGradient>
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0D0B1A', '#1A1625']} style={styles.gradient}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Reservation not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
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
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Complete Payment</Text>
            <View style={styles.headerPlaceholder} />
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Booking Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="tennisball" size={24} color="#8B5CF6" />
                <Text style={styles.summaryTitle}>Booking Summary</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Court</Text>
                <Text style={styles.summaryValue}>{reservation.court.name}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Venue</Text>
                <Text style={styles.summaryValue}>{reservation.court.venue.name}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{formatDate(reservation.reservation_date)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time</Text>
                <Text style={styles.summaryValue}>
                  {formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>
                  {reservation.duration_hours} hour{reservation.duration_hours > 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rate</Text>
                <Text style={styles.summaryValue}>₱{reservation.court.hourly_rate}/hr</Text>
              </View>
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₱{reservation.total_amount}</Text>
              </View>
            </View>

            {/* Payment Methods */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Payment Method</Text>
              
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethod,
                    selectedMethod === method.id && styles.paymentMethodSelected
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  <View style={styles.paymentMethodLeft}>
                    <Text style={styles.paymentMethodIcon}>{method.icon}</Text>
                    <Text style={styles.paymentMethodName}>{method.name}</Text>
                  </View>
                  <View style={[
                    styles.radioButton,
                    selectedMethod === method.id && styles.radioButtonSelected
                  ]}>
                    {selectedMethod === method.id && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.securityText}>
                Your payment is secured by PayMongo. We never store your payment details.
              </Text>
            </View>

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Bottom Pay Button */}
          <View style={styles.bottomBar}>
            <View style={styles.totalDisplay}>
              <Text style={styles.totalDisplayLabel}>Total</Text>
              <Text style={styles.totalDisplayAmount}>₱{reservation.total_amount}</Text>
            </View>
            <TouchableOpacity 
              style={styles.payButton}
              onPress={handlePayment}
              disabled={processing}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.payButtonGradient}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                    <Text style={styles.payButtonText}>Pay Now</Text>
                  </>
                )}
              </LinearGradient>
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
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#1A1625',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#252038',
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#252038',
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1625',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#252038',
  },
  paymentMethodSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethodIcon: {
    fontSize: 24,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4B5563',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#8B5CF6',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8B5CF6',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#10B981',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#1A1625',
    borderTopWidth: 1,
    borderTopColor: '#252038',
  },
  totalDisplay: {},
  totalDisplayLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  totalDisplayAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 160,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
