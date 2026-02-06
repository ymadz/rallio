import React from 'react';
import {
    View,
    Text,
    StyleSheet,

    ScrollView,
    TouchableOpacity,
    Alert,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Avatar, Button } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';

interface MenuItemProps {
    icon: string;
    iconSet?: 'ionicons' | 'material';
    label: string;
    color?: string;
    onPress: () => void;
    rightText?: string;
}

const MenuItem = ({ icon, iconSet = 'ionicons', label, color, onPress, rightText }: MenuItemProps) => {
    const iconColor = color || Colors.dark.primary;

    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={[styles.menuIcon, { backgroundColor: iconColor + '20' }]}>
                {iconSet === 'material' ? (
                    <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
                ) : (
                    <Ionicons name={icon as any} size={22} color={iconColor} />
                )}
            </View>
            <Text style={styles.menuText}>{label}</Text>
            {rightText && <Text style={styles.menuRightText}>{rightText}</Text>}
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
        </TouchableOpacity>
    );
};

export default function ProfileScreen() {
    const { profile, player, signOut, isLoading } = useAuthStore();

    const fullName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : profile?.display_name || 'Player';

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
        if (!level) return 'Unranked';
        if (level <= 2) return 'Beginner';
        if (level <= 4) return 'Intermediate';
        if (level <= 6) return 'Advanced';
        if (level <= 8) return 'Expert';
        return 'Elite';
    };

    const winRate = player?.total_games_played && player.total_games_played > 0
        ? Math.round((player.total_wins || 0) / player.total_games_played * 100)
        : 0;

    const handleEditProfile = () => {
        router.push('/profile/edit');
    };

    const handleMatchHistory = () => {
        // TODO: Implement match history screen
        Alert.alert('Coming Soon', 'Match history will be available soon!');
    };

    const handleNotifications = () => {
        // TODO: Navigate to notifications settings
        Alert.alert('Coming Soon', 'Notification settings will be available soon!');
    };

    const handleSettings = () => {
        // TODO: Navigate to settings screen
        Alert.alert('Coming Soon', 'Settings will be available soon!');
    };

    const handleSupport = () => {
        Linking.openURL('mailto:support@rallio.app');
    };

    const handlePrivacy = () => {
        Linking.openURL('https://rallio.app/privacy');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                        <Ionicons name="pencil" size={18} color={Colors.dark.text} />
                    </TouchableOpacity>

                    <Avatar source={profile?.avatar_url} name={fullName} size="xl" />
                    <Text style={styles.name}>{fullName}</Text>

                    {profile?.bio && (
                        <Text style={styles.bio}>{profile.bio}</Text>
                    )}

                    <View style={styles.badgeRow}>
                        <View style={styles.skillBadge}>
                            <MaterialCommunityIcons name="badminton" size={14} color={Colors.dark.primary} />
                            <Text style={styles.skillText}>{getSkillLabel(player?.skill_level)}</Text>
                        </View>
                        {player?.preferred_play_style && player.preferred_play_style !== 'All' && (
                            <View style={styles.styleBadge}>
                                <Text style={styles.styleText}>{player.preferred_play_style}</Text>
                            </View>
                        )}
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
                            <Text style={styles.statValue}>{winRate}%</Text>
                            <Text style={styles.statLabel}>Win Rate</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player?.rating || '-'}</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>

                    </View>
                </Card>

                {/* Quick Stats */}
                <View style={styles.quickStats}>
                    <Card variant="default" padding="md" style={styles.quickStatCard}>
                        <View style={[styles.quickStatIcon, { backgroundColor: Colors.dark.success + '20' }]}>
                            <Ionicons name="flame" size={20} color={Colors.dark.success} />
                        </View>
                        <Text style={styles.quickStatValue}>{player?.current_win_streak || 0}</Text>
                        <Text style={styles.quickStatLabel}>Win Streak</Text>
                    </Card>
                    <Card variant="default" padding="md" style={styles.quickStatCard}>
                        <View style={[styles.quickStatIcon, { backgroundColor: Colors.dark.warning + '20' }]}>
                            <Ionicons name="trophy" size={20} color={Colors.dark.warning} />
                        </View>
                        <Text style={styles.quickStatValue}>{player?.max_win_streak || 0}</Text>
                        <Text style={styles.quickStatLabel}>Best Streak</Text>
                    </Card>
                </View>

                {/* Menu Items */}
                <View style={styles.menu}>
                    <Text style={styles.menuSectionTitle}>Account</Text>

                    <MenuItem
                        icon="person-outline"
                        label="Edit Profile"
                        onPress={handleEditProfile}
                    />
                    <MenuItem
                        icon="trophy-outline"
                        label="Match History"
                        color={Colors.dark.info}
                        onPress={handleMatchHistory}
                    />
                    <MenuItem
                        icon="notifications-outline"
                        label="Notifications"
                        color={Colors.dark.warning}
                        onPress={handleNotifications}
                    />
                </View>

                <View style={styles.menu}>
                    <Text style={styles.menuSectionTitle}>App</Text>

                    <MenuItem
                        icon="settings-outline"
                        label="Settings"
                        color={Colors.dark.textSecondary}
                        onPress={handleSettings}
                    />
                    <MenuItem
                        icon="help-circle-outline"
                        label="Help & Support"
                        color={Colors.dark.info}
                        onPress={handleSupport}
                    />
                    <MenuItem
                        icon="shield-checkmark-outline"
                        label="Privacy Policy"
                        color={Colors.dark.success}
                        onPress={handlePrivacy}
                    />
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
        paddingBottom: 100,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
        marginTop: Spacing.md,
        position: 'relative',
    },
    editButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    name: {
        ...Typography.h2,
        color: Colors.dark.text,
        marginTop: Spacing.md,
    },
    bio: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.xl,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    skillBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.dark.primary + '20',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
    },
    skillText: {
        ...Typography.bodySmall,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    styleBadge: {
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    styleText: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
    },
    statsCard: {
        marginBottom: Spacing.md,
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
    quickStats: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    quickStatCard: {
        flex: 1,
        alignItems: 'center',
    },
    quickStatIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xs,
    },
    quickStatValue: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    quickStatLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    menu: {
        marginBottom: Spacing.lg,
    },
    menuSectionTitle: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
        marginLeft: Spacing.xs,
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
    menuRightText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginRight: Spacing.xs,
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
