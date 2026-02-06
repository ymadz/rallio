import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,

    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button, Avatar } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

const SKILL_LEVELS_DISPLAY = {
    1: { label: 'Beginner', description: 'ELO 1200 - 1499' },
    4: { label: 'Intermediate', description: 'ELO 1500 - 1799' },
    7: { label: 'Advanced', description: 'ELO 1800 - 2099' },
    10: { label: 'Expert', description: 'ELO 2100+' },
};

const PLAY_STYLES = ['Singles', 'Doubles', 'Mixed Doubles', 'All'];

export default function EditProfileScreen() {
    const { user, profile, player, fetchProfile } = useAuthStore();

    const [firstName, setFirstName] = useState(profile?.first_name || '');
    const [lastName, setLastName] = useState(profile?.last_name || '');
    const [displayName, setDisplayName] = useState(profile?.display_name || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [skillLevel, setSkillLevel] = useState(player?.skill_level || 3);
    const [preferredStyle, setPreferredStyle] = useState(player?.preferred_play_style || 'All');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        try {
            // Update profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    display_name: displayName.trim() || `${firstName} ${lastName}`.trim(),
                    bio: bio.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Update player stats
            const { error: playerError } = await supabase
                .from('players')
                .update({
                    preferred_play_style: preferredStyle,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);

            if (playerError) throw playerError;

            // Refresh profile data
            await fetchProfile();

            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            Alert.alert('Error', err.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const fullName = `${firstName} ${lastName}`.trim() || 'Player';

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Edit Profile</Text>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <Text style={[styles.saveText, isSaving && styles.saveTextDisabled]}>
                                {isSaving ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Avatar Section */}
                    <View style={styles.avatarSection}>
                        <Avatar source={profile?.avatar_url} name={fullName} size="xl" />
                        <TouchableOpacity style={styles.changePhotoButton}>
                            <Ionicons name="camera" size={18} color={Colors.dark.primary} />
                            <Text style={styles.changePhotoText}>Change Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Personal Information */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>First Name</Text>
                            <TextInput
                                style={styles.input}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder="Enter first name"
                                placeholderTextColor={Colors.dark.textTertiary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder="Enter last name"
                                placeholderTextColor={Colors.dark.textTertiary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Display Name</Text>
                            <TextInput
                                style={styles.input}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder="How others see you"
                                placeholderTextColor={Colors.dark.textTertiary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Tell others about yourself..."
                                placeholderTextColor={Colors.dark.textTertiary}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    {/* Player Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Player Settings</Text>

                        {/* Skill Level */}
                        <Text style={styles.inputLabel}>Skill Level (Read-Only)</Text>
                        <View style={styles.readOnlySkillContainer}>
                            <View style={styles.readOnlySkillContent}>
                                <Text style={styles.readOnlySkillLabel}>
                                    {SKILL_LEVELS_DISPLAY[player?.skill_level as keyof typeof SKILL_LEVELS_DISPLAY]?.label || 'Unranked'}
                                </Text>
                                <Text style={styles.readOnlySkillDescription}>
                                    {SKILL_LEVELS_DISPLAY[player?.skill_level as keyof typeof SKILL_LEVELS_DISPLAY]?.description || `${player?.rating} ELO`}
                                </Text>
                            </View>
                            <View style={styles.readOnlySkillInfo}>
                                <Ionicons name="lock-closed" size={16} color={Colors.dark.textSecondary} />
                                <Text style={styles.readOnlySkillInfoText}>
                                    Determined by match performance
                                </Text>
                            </View>
                        </View>

                        {/* Preferred Play Style */}
                        <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Preferred Play Style</Text>
                        <View style={styles.styleGrid}>
                            {PLAY_STYLES.map((style) => (
                                <TouchableOpacity
                                    key={style}
                                    style={[
                                        styles.styleOption,
                                        preferredStyle === style && styles.styleOptionSelected
                                    ]}
                                    onPress={() => setPreferredStyle(style)}
                                >
                                    <Text style={[
                                        styles.styleText,
                                        preferredStyle === style && styles.styleTextSelected
                                    ]}>
                                        {style}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Save Button (bottom) */}
                    <View style={styles.bottomSection}>
                        <Button fullWidth onPress={handleSave} loading={isSaving}>
                            Save Changes
                        </Button>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    saveButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    saveText: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    saveTextDisabled: {
        color: Colors.dark.textTertiary,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    changePhotoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.md,
        gap: Spacing.xs,
    },
    changePhotoText: {
        ...Typography.body,
        color: Colors.dark.primary,
    },
    section: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    inputGroup: {
        marginBottom: Spacing.md,
    },
    inputLabel: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        ...Typography.body,
        color: Colors.dark.text,
    },
    textArea: {
        minHeight: 80,
        paddingTop: Spacing.sm,
    },
    skillGrid: {
        gap: Spacing.sm,
    },
    skillOption: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    skillOptionSelected: {
        borderColor: Colors.dark.primary,
        backgroundColor: Colors.dark.primary + '15',
    },
    skillLabel: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    skillLabelSelected: {
        color: Colors.dark.primary,
    },
    skillDescription: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    styleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    styleOption: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    styleOptionSelected: {
        borderColor: Colors.dark.primary,
        backgroundColor: Colors.dark.primary + '15',
    },
    styleText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    styleTextSelected: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    bottomSection: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    readOnlySkillContainer: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    readOnlySkillContent: {
        marginBottom: Spacing.sm,
    },
    readOnlySkillLabel: {
        ...Typography.h4,
        color: Colors.dark.text,
        marginBottom: 2,
    },
    readOnlySkillDescription: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    readOnlySkillInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    readOnlySkillInfoText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontStyle: 'italic',
    },
});
