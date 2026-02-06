import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface StepSkillLevelProps {
    skillLevel: number;
    onSelectLevel: (level: number) => void;
    onSubmit: () => void;
    onBack: () => void;
    isLoading: boolean;
}

const SKILL_LEVELS = [
    { value: 1, label: 'Beginner', description: 'Just starting out (ELO 1200)' },
    { value: 4, label: 'Intermediate', description: 'Comfortable with basics (ELO 1500)' },
    { value: 7, label: 'Advanced', description: 'Strong competitive player (ELO 1800)' },
    { value: 10, label: 'Expert', description: 'Tournament level (ELO 2100)' },
];

export default function StepSkillLevel({ skillLevel, onSelectLevel, onSubmit, onBack, isLoading }: StepSkillLevelProps) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.textSecondary} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Confirm Your Skill Level</Text>
                <Text style={styles.subtitle}>Select your starting tier. This determines your initial matchmaking rating and can only be changed by match performance.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {SKILL_LEVELS.map((level) => {
                    const isSelected = skillLevel === level.value;
                    return (
                        <TouchableOpacity
                            key={level.value}
                            style={[styles.option, isSelected && styles.optionSelected]}
                            onPress={() => onSelectLevel(level.value)}
                            activeOpacity={0.7}
                        >
                            <View>
                                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                    {level.label}
                                </Text>
                                <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                                    {level.description}
                                </Text>
                            </View>
                            {isSelected && (
                                <Ionicons name="checkmark-circle" size={24} color={Colors.dark.text} />
                            )}
                        </TouchableOpacity>
                    );
                })}

                <View style={styles.warningContainer}>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.dark.textSecondary} />
                    <Text style={styles.warningText}>
                        To modify this later, you will need to contact a Global Admin with proof of skill.
                    </Text>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={onSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
            >
                <Text style={styles.buttonText}>
                    {isLoading ? 'Setting Up...' : 'Confirm & Finish'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: Spacing.xl,
    },
    header: {
        marginBottom: Spacing.lg,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    backText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        marginLeft: Spacing.xs,
    },
    title: {
        ...Typography.h2,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    list: {
        gap: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    optionSelected: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    optionLabel: {
        ...Typography.h4,
        color: Colors.dark.text,
        marginBottom: 4,
    },
    optionLabelSelected: {
        color: Colors.dark.text, // Usually black or white depending on primary contrast, keeping text readable
        fontWeight: '700',
    },
    optionDescription: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    optionDescriptionSelected: {
        color: 'rgba(0,0,0, 0.7)',
    },
    button: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: Spacing.md,
        borderRadius: Radius.lg,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        ...Typography.button,
        color: Colors.dark.text,
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginTop: Spacing.md,
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    warningText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        flex: 1,
    },
});
