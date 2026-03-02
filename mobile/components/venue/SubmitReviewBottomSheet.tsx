import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Button } from '@/components/ui';
import { apiPost } from '@/lib/api';

interface SubmitReviewBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    courtId: string;
    courtName: string;
    reservationId?: string;
}

const RATING_CATEGORIES: { key: string; label: string; required?: boolean }[] = [
    { key: 'overall', label: 'Overall', required: true },
    { key: 'quality', label: 'Court Quality' },
    { key: 'cleanliness', label: 'Cleanliness' },
    { key: 'facilities', label: 'Facilities' },
    { key: 'value', label: 'Value for Money' },
];

export default function SubmitReviewBottomSheet({
    visible,
    onClose,
    onSuccess,
    courtId,
    courtName,
    reservationId,
}: SubmitReviewBottomSheetProps) {
    const [ratings, setRatings] = useState<Record<string, number>>({ overall: 0 });
    const [reviewText, setReviewText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const setRating = (key: string, value: number) => {
        setRatings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (ratings.overall === 0) {
            Alert.alert('Error', 'Please provide an overall rating');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await apiPost('/api/mobile/submit-review', {
                courtId,
                reservationId,
                overallRating: ratings.overall,
                qualityRating: ratings.quality || undefined,
                cleanlinessRating: ratings.cleanliness || undefined,
                facilitiesRating: ratings.facilities || undefined,
                valueRating: ratings.value || undefined,
                review: reviewText.trim() || undefined,
            });

            if (result.success) {
                Alert.alert('Thank You!', 'Your review has been submitted.', [
                    { text: 'OK', onPress: onSuccess },
                ]);
                // Reset form
                setRatings({ overall: 0 });
                setReviewText('');
            } else {
                Alert.alert('Error', result.error || 'Failed to submit review');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit review');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStars = (key: string, currentRating: number) => (
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                    key={star}
                    onPress={() => setRating(key, star)}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={star <= currentRating ? 'star' : 'star-outline'}
                        size={28}
                        color={star <= currentRating ? '#F59E0B' : Colors.dark.textTertiary}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Write a Review</Text>
                            <Text style={styles.subtitle}>{courtName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Rating Categories */}
                        {RATING_CATEGORIES.map(({ key, label, required }) => (
                            <View key={key} style={styles.ratingRow}>
                                <View style={styles.ratingLabel}>
                                    <Text style={styles.ratingLabelText}>{label}</Text>
                                    {required && <Text style={styles.requiredStar}>*</Text>}
                                </View>
                                {renderStars(key, ratings[key] || 0)}
                            </View>
                        ))}

                        {/* Review Text */}
                        <Text style={styles.sectionLabel}>Your Review (optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Share your experience..."
                            placeholderTextColor={Colors.dark.textTertiary}
                            multiline
                            numberOfLines={4}
                            value={reviewText}
                            onChangeText={setReviewText}
                            textAlignVertical="top"
                            maxLength={500}
                        />
                        <Text style={styles.charCount}>{reviewText.length}/500</Text>

                        <View style={{ height: 80 }} />
                    </ScrollView>

                    {/* Submit Button */}
                    <View style={styles.footer}>
                        <Button
                            variant="primary"
                            onPress={handleSubmit}
                            disabled={ratings.overall === 0 || isSubmitting}
                            style={styles.submitButton}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Review'}
                        </Button>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: Colors.dark.background,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    title: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    subtitle: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: Spacing.lg,
    },
    ratingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border + '40',
    },
    ratingLabel: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingLabelText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    requiredStar: {
        color: Colors.dark.error,
        marginLeft: 2,
        fontSize: 16,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    sectionLabel: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    textInput: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.md,
        padding: Spacing.md,
        color: Colors.dark.text,
        minHeight: 100,
        ...Typography.body,
    },
    charCount: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        textAlign: 'right',
        marginTop: 4,
    },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    submitButton: {
        width: '100%',
    },
});
