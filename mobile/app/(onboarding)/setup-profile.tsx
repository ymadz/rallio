import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { Colors } from '@/constants/Colors';

import StepIntro from '@/components/onboarding/StepIntro';
import StepDetails from '@/components/onboarding/StepDetails';
import StepPlayerInfo from '@/components/onboarding/StepPlayerInfo';
import StepPlayStyles from '@/components/onboarding/StepPlayStyles';
import StepSkillLevel from '@/components/onboarding/StepSkillLevel';

// Map Skill Level to Starting ELO
const INITIAL_ELO_MAP: Record<number, number> = {
    1: 1200, // Beginner
    4: 1500, // Intermediate
    7: 1800, // Advanced
    10: 2100 // Expert
};

type Step = 'intro' | 'details' | 'player-info' | 'play-styles' | 'skill-level';

export default function SetupProfilePage() {
    const { user, fetchProfile } = useAuthStore();
    const [step, setStep] = useState<Step>('intro');
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        middleInitial: '',
        lastName: '',
        phone: '',
        avatarUri: '',
        birthDate: null as Date | null,
        gender: '',
        playStyles: [] as string[],
        skillLevel: 5,
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                firstName: user.user_metadata?.first_name || '',
                lastName: user.user_metadata?.last_name || '',
                phone: user.user_metadata?.phone || '',
            }));
        }
    }, [user]);

    const updateFormData = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const togglePlayStyle = (style: string) => {
        setFormData(prev => {
            const styles = prev.playStyles.includes(style)
                ? prev.playStyles.filter(s => s !== style)
                : [...prev.playStyles, style];
            return { ...prev, playStyles: styles };
        });
    };

    const handleComplete = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            let avatarUrl = null;

            // Upload avatar if changed
            if (formData.avatarUri && !formData.avatarUri.startsWith('http')) {
                const fileExt = formData.avatarUri.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `avatars/${fileName}`;

                const arrayBuffer = await fetch(formData.avatarUri).then(res => res.arrayBuffer());

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, arrayBuffer, {
                        contentType: `image/${fileExt}`,
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                avatarUrl = publicUrl;
            }

            // Update Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    display_name: `${formData.firstName} ${formData.lastName}`,
                    phone: formData.phone,
                    avatar_url: avatarUrl,
                    profile_completed: true,
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Update Player with ELO Seed
            const startingElo = INITIAL_ELO_MAP[formData.skillLevel] || 1500;

            const { error: playerError } = await supabase
                .from('players')
                .update({
                    skill_level: formData.skillLevel,
                    play_style: formData.playStyles.join(','),
                    rating: startingElo, // Seeding ELO
                    birth_date: formData.birthDate ? formData.birthDate.toISOString() : null,
                    gender: formData.gender,
                })
                .eq('user_id', user.id);

            if (playerError) {
                console.warn('Player update failed', playerError);
                // Non-blocking
            }

            await fetchProfile();
            router.replace('/(tabs)');

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return <View style={styles.center}><ActivityIndicator /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            {step === 'intro' && (
                <StepIntro onNext={() => setStep('details')} />
            )}

            {step === 'details' && (
                <StepDetails
                    data={formData}
                    onUpdate={updateFormData}
                    onNext={() => setStep('player-info')}
                />
            )}

            {step === 'player-info' && (
                <StepPlayerInfo
                    data={formData}
                    onUpdate={updateFormData}
                    onNext={() => setStep('play-styles')}
                    onBack={() => setStep('details')}
                />
            )}

            {step === 'play-styles' && (
                <StepPlayStyles
                    selectedStyles={formData.playStyles}
                    onToggleStyle={togglePlayStyle}
                    onNext={() => setStep('skill-level')}
                    onBack={() => setStep('player-info')}
                />
            )}

            {step === 'skill-level' && (
                <StepSkillLevel
                    skillLevel={formData.skillLevel}
                    onSelectLevel={(level) => updateFormData('skillLevel', level)}
                    onSubmit={handleComplete}
                    onBack={() => setStep('play-styles')}
                    isLoading={isLoading}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    center: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
