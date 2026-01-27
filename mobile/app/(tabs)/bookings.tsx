import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/constants/Colors';
import { Card } from '@/components/ui';

export default function BookingsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Bookings</Text>
            </View>
            <View style={styles.content}>
                <Card variant="glass" padding="lg" style={styles.emptyCard}>
                    <Ionicons name="calendar-outline" size={64} color={Colors.dark.textTertiary} />
                    <Text style={styles.emptyTitle}>No Bookings Yet</Text>
                    <Text style={styles.emptyText}>
                        Book a court and your reservations will appear here
                    </Text>
                </Card>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        padding: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
        justifyContent: 'center',
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
