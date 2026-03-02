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
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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

const PLAY_STYLES = [
    'Singles',
    'Doubles',
    'Mixed Doubles',
    'Attacking / Speed',
    'Defensive',
    'All-Round',
    'Deceptive',
    'Control',
    'Net-Play Specialist',
    'All'
];

export default function EditProfileScreen() {
    const { user, profile, player, fetchProfile } = useAuthStore();

    const [firstName, setFirstName] = useState(profile?.first_name || '');
    const [lastName, setLastName] = useState(profile?.last_name || '');
    const [displayName, setDisplayName] = useState(profile?.display_name || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [skillLevel, setSkillLevel] = useState(player?.skill_level || 3);

    // Parse initial styles from play_style (CSV) or fall back to preferred_play_style
    const initialStyles = player?.play_style
        ? player.play_style.split(',')
        : player?.preferred_play_style
            ? [player.preferred_play_style]
            : [];

    const [selectedStyles, setSelectedStyles] = useState<string[]>(initialStyles);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);

    const pickAndUploadAvatar = async () => {
        if (!user) return;

        // Request media library permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to change your avatar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (result.canceled || !result.assets[0]?.uri) return;

        setIsUploadingAvatar(true);
        try {
            const uri = result.assets[0].uri;
            const ext = uri.split('.').pop() ?? 'jpg';
            const path = `avatars/${user.id}-${Date.now()}.${ext}`;

            // Fetch file as buffer
            const response = await fetch(uri);
            const buffer = await response.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, buffer, {
                    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(path);

            // Persist to profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            await fetchProfile();
        } catch (err: any) {
            Alert.alert('Upload Failed', err.message || 'Could not upload photo. Please try again.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const toggleStyle = (style: string) => {
        if (style === 'All') {
            setSelectedStyles(['All']);
            return;
        }

        setSelectedStyles(prev => {
            // If 'All' was selected, clear it
            let newStyles = prev.filter(s => s !== 'All');

            if (newStyles.includes(style)) {
                return newStyles.filter(s => s !== style);
            } else {
                return [...newStyles, style];
            }
        });
    };

    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        try {
            // Update profile
            // Note: 'bio' column might be missing in schema, removing it for now based on error
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
            const playStyleCSV = selectedStyles.join(',');

            const { error: playerError } = await supabase
                .from('players')
                .update({
                    play_style: playStyleCSV,
                    preferred_play_style: selectedStyles[0] || 'All', // Keep legacy column synced with primary
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

    const currentAvatarUrl = avatarUrl ?? profile?.avatar_url;

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
                        <View style={styles.avatarWrapper}>
                            <Avatar source={currentAvatarUrl} name={fullName} size="xl" />
                            {isUploadingAvatar && (
                                <View style={styles.avatarLoadingOverlay}>
                                    <ActivityIndicator color={Colors.dark.primary} />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            style={styles.changePhotoButton}
                            onPress={pickAndUploadAvatar}
                            disabled={isUploadingAvatar}
                        >
                            <Ionicons
                                name="camera"
                                size={18}
                                color={isUploadingAvatar ? Colors.dark.textTertiary : Colors.dark.primary}
                            />
                            <Text style={[
                                styles.changePhotoText,
                                isUploadingAvatar && styles.changePhotoTextDisabled,
                            ]}>
                                {isUploadingAvatar ? 'Uploading…' : 'Change Photo'}
                            </Text>
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
                            {PLAY_STYLES.map((style) => {
                                const isSelected = selectedStyles.includes(style);
                                return (
                                    <TouchableOpacity
                                        key={style}
                                        style={[
                                            styles.styleOption,
                                            isSelected && styles.styleOptionSelected
                                        ]}
                                        onPress={() => toggleStyle(style)}
                                    >
                                        <Text style={[
                                            styles.styleText,
                                            isSelected && styles.styleTextSelected
                                        ]}>
                                            {style}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
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
    avatarWrapper: {
        position: 'relative',
    },
    avatarLoadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 9999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
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
    changePhotoTextDisabled: {
        color: Colors.dark.textTertiary,
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
