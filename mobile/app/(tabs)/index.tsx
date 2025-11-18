import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/config';

// Placeholder court data - will be replaced with API data
const PLACEHOLDER_COURTS = [
  {
    id: '1',
    name: 'Sample Court 1',
    venue: 'Demo Venue',
    price: 200,
    type: 'indoor',
  },
  {
    id: '2',
    name: 'Sample Court 2',
    venue: 'Demo Venue',
    price: 150,
    type: 'outdoor',
  },
];

export default function CourtsScreen() {
  const renderCourtCard = ({ item }: { item: typeof PLACEHOLDER_COURTS[0] }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.courtName}>{item.name}</Text>
        <Text style={styles.venueName}>{item.venue}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.price}>₱{item.price}/hr</Text>
          <Text style={styles.type}>{item.type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Courts</Text>
        <Text style={styles.subtitle}>Discover badminton courts near you</Text>
      </View>

      <FlatList
        data={PLACEHOLDER_COURTS}
        renderItem={renderCourtCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No courts found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  courtName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  venueName: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  type: {
    fontSize: 12,
    color: colors.secondary,
    textTransform: 'capitalize',
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.secondary,
  },
});
