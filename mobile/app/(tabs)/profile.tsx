import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Avatar, Button } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';

export default function ProfileScreen() {
    const { profile, player, signOut, isLoading } = useAuthStore();

    const fullName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : 'Player';

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]
        );
    };

    const getSkillLabel = (level: number | null | undefined) => {
        if (!level) return 'Not set';
        if (level <= 2) return 'Beginner';
        if (level <= 4) return 'Intermediate';
        if (level <= 6) return 'Advanced';
        if (level <= 8) return 'Expert';
        return 'Elite';
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Avatar source={profile?.avatar_url} name={fullName} size="xl" />
                    <Text style={styles.name}>{fullName}</Text>
                    <View style={styles.skillBadge}>
                        <Text style={styles.skillText}>{getSkillLabel(player?.skill_level)}</Text>
                    </View>
                </View>

                {/* Stats Card */}
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
                            <Text style={styles.statValue}>{player?.rating || 1500}</Text>
                            <Text style={styles.statLabel}>ELO</Text>
                        </View>
                    </View>
                </Card>

                {/* Menu Items */}
                <View style={styles.menu}>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={[styles.menuIcon, { backgroundColor: Colors.dark.primary + '20' }]}>
                            <Ionicons name="person-outline" size={22} color={Colors.dark.primary} />
                        </View>
                        <Text style={styles.menuText}>Edit Profile</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={[styles.menuIcon, { backgroundColor: Colors.dark.info + '20' }]}>
                            <Ionicons name="trophy-outline" size={22} color={Colors.dark.info} />
                        </View>
                        <Text style={styles.menuText}>Match History</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={[styles.menuIcon, { backgroundColor: Colors.dark.warning + '20' }]}>
                            <Ionicons name="notifications-outline" size={22} color={Colors.dark.warning} />
                        </View>
                        <Text style={styles.menuText}>Notifications</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={[styles.menuIcon, { backgroundColor: Colors.dark.textTertiary + '20' }]}>
                            <Ionicons name="settings-outline" size={22} color={Colors.dark.textTertiary} />
                        </View>
                        <Text style={styles.menuText}>Settings</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
                    </TouchableOpacity>
                </View>

                {/* Sign Out */}
                <Button
                    variant="secondary"
                    fullWidth
                    onPress={handleSignOut}
                    loading={isLoading}
                    style={styles.signOutButton}
                >
                    Sign Out
                </Button>

                {/* Version */}
                <Text style={styles.version}>Rallio v1.0.0</Text>
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
        alignItems: 'center',
        marginBottom: Spacing.xl,
        marginTop: Spacing.md,
    },
    name: {
        ...Typography.h2,
        color: Colors.dark.text,
        marginTop: Spacing.md,
    },
    skillBadge: {
        backgroundColor: Colors.dark.primary + '20',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
        marginTop: Spacing.sm,
    },
    skillText: {
        ...Typography.bodySmall,
        color: Colors.dark.primary,
        fontWeight: '600',
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
    menu: {
        marginBottom: Spacing.xl,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    menuText: {
        ...Typography.body,
        color: Colors.dark.text,
        flex: 1,
    },
    signOutButton: {
        marginBottom: Spacing.md,
    },
    version: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        textAlign: 'center',
    },
});
