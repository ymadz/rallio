import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');
const STORAGE_KEY = 'rallio_booking_tutorial_seen';

interface TutorialStep {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    color: string;
}

const STEPS: TutorialStep[] = [
    {
        icon: 'calendar-outline',
        title: 'Pick a Date',
        description: 'Scroll through available dates and tap to select when you want to play.',
        color: Colors.dark.primary,
    },
    {
        icon: 'time-outline',
        title: 'Choose Time Slots',
        description: 'Green slots are available. Tap consecutive slots to set your playing duration.',
        color: Colors.dark.success,
    },
    {
        icon: 'people-outline',
        title: 'Set Player Count',
        description: 'Adjust the number of players. This helps with court capacity and split payments.',
        color: Colors.dark.info,
    },
    {
        icon: 'wallet-outline',
        title: 'Pay & Confirm',
        description: 'Choose e-wallet (GCash/Maya) or cash. Review your booking and confirm!',
        color: Colors.dark.warning,
    },
];

interface BookingTutorialProps {
    /** Force show even if previously dismissed */
    forceShow?: boolean;
}

export default function BookingTutorial({ forceShow }: BookingTutorialProps) {
    const [visible, setVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        checkIfSeen();
    }, []);

    const checkIfSeen = async () => {
        if (forceShow) {
            setVisible(true);
            return;
        }
        try {
            const seen = await AsyncStorage.getItem(STORAGE_KEY);
            if (!seen) {
                setVisible(true);
            }
        } catch {
            // If storage fails, show it
            setVisible(true);
        }
    };

    const handleDismiss = async () => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, 'true');
        } catch {
            // Best effort
        }
        setVisible(false);
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleDismiss();
        }
    };

    const handleSkip = () => {
        handleDismiss();
    };

    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Skip button */}
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    {/* Step icon */}
                    <View style={[styles.iconCircle, { backgroundColor: step.color + '20' }]}>
                        <Ionicons name={step.icon} size={40} color={step.color} />
                    </View>

                    {/* Step counter */}
                    <Text style={styles.stepCounter}>
                        Step {currentStep + 1} of {STEPS.length}
                    </Text>

                    {/* Content */}
                    <Text style={styles.title}>{step.title}</Text>
                    <Text style={styles.description}>{step.description}</Text>

                    {/* Progress dots */}
                    <View style={styles.dots}>
                        {STEPS.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === currentStep && styles.dotActive,
                                    i < currentStep && styles.dotDone,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Action button */}
                    <TouchableOpacity
                        style={[styles.nextButton, { backgroundColor: step.color }]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.nextText}>
                            {isLast ? 'Got it!' : 'Next'}
                        </Text>
                        {!isLast && (
                            <Ionicons name="arrow-forward" size={18} color={Colors.dark.text} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    card: {
        width: width - Spacing.xl * 2,
        maxWidth: 360,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    skipButton: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        padding: Spacing.sm,
    },
    skipText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        fontSize: 13,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
        marginTop: Spacing.sm,
    },
    stepCounter: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.xs,
    },
    title: {
        ...Typography.h2,
        color: Colors.dark.text,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    description: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.lg,
    },
    dots: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: Spacing.lg,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.border,
    },
    dotActive: {
        width: 24,
        backgroundColor: Colors.dark.primary,
    },
    dotDone: {
        backgroundColor: Colors.dark.primary + '60',
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: Radius.md,
        width: '100%',
    },
    nextText: {
        ...Typography.button,
        color: Colors.dark.text,
        fontWeight: '700',
    },
});
