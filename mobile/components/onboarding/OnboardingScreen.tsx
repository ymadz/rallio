import React, { useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolate,
    Extrapolation,
    SharedValue,
} from 'react-native-reanimated';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
    id: string;
    icon: string;
    iconSet: 'ionicons' | 'material-community';
    title: string;
    description: string;
    color: string;
}

const SLIDES: OnboardingSlide[] = [
    {
        id: '1',
        icon: 'badminton',
        iconSet: 'material-community',
        title: 'Find Courts Near You',
        description: 'Discover badminton courts in your area. Book instantly and play whenever you want.',
        color: Colors.dark.primary,
    },
    {
        id: '2',
        icon: 'calendar',
        iconSet: 'ionicons',
        title: 'Easy Booking',
        description: 'Reserve courts in seconds. No more waiting in line or making phone calls.',
        color: Colors.dark.success,
    },
    {
        id: '3',
        icon: 'people',
        iconSet: 'ionicons',
        title: 'Join The Community',
        description: 'Connect with players, join queues, and track your progress as you improve.',
        color: Colors.dark.info,
    },
];

interface SlideItemProps {
    item: OnboardingSlide;
    index: number;
    scrollX: SharedValue<number>;
}

const SlideItem = React.memo(({ item, index, scrollX }: SlideItemProps) => {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];

        const scale = interpolate(
            scrollX.value,
            inputRange,
            [0.8, 1, 0.8],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.5, 1, 0.5],
            Extrapolation.CLAMP
        );

        return { transform: [{ scale }], opacity };
    });

    const renderIcon = () => {
        if (item.iconSet === 'material-community') {
            return <MaterialCommunityIcons name={item.icon as any} size={80} color={item.color} />;
        }
        return <Ionicons name={item.icon as any} size={80} color={item.color} />;
    };

    return (
        <View style={styles.slide}>
            <Animated.View style={[styles.iconContainer, animatedStyle, { backgroundColor: item.color + '15' }]}>
                {renderIcon()}
            </Animated.View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );
});

SlideItem.displayName = 'SlideItem';

interface PaginationDotProps {
    index: number;
    scrollX: SharedValue<number>;
}

const PaginationDot = React.memo(({ index, scrollX }: PaginationDotProps) => {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];

        const width = interpolate(
            scrollX.value,
            inputRange,
            [8, 24, 8],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.4, 1, 0.4],
            Extrapolation.CLAMP
        );

        return { width, opacity };
    });

    return <Animated.View style={[styles.dot, animatedStyle]} />;
});

PaginationDot.displayName = 'PaginationDot';

interface OnboardingScreenProps {
    onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useSharedValue(0);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleScroll = useCallback((event: any) => {
        scrollX.value = event.nativeEvent.contentOffset.x;
    }, []);

    const handleViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index !== null) {
                setCurrentIndex(viewableItems[0].index);
            }
        },
        []
    );

    const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

    const handleNext = useCallback(() => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            onComplete();
        }
    }, [currentIndex, onComplete]);

    const handleSkip = useCallback(() => {
        onComplete();
    }, [onComplete]);

    const isLastSlide = currentIndex === SLIDES.length - 1;

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Skip button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <SlideItem item={item} index={index} scrollX={scrollX} />
                )}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            {/* Bottom section */}
            <View style={styles.bottomSection}>
                {/* Pagination */}
                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => (
                        <PaginationDot key={index} index={index} scrollX={scrollX} />
                    ))}
                </View>

                {/* Buttons */}
                <View style={styles.buttonsRow}>
                    <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>
                            {isLastSlide ? 'Get Started' : 'Next'}
                        </Text>
                        {!isLastSlide && (
                            <Ionicons name="arrow-forward" size={20} color={Colors.dark.text} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: Spacing.lg,
        zIndex: 10,
        padding: Spacing.sm,
    },
    skipText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    slide: {
        width: SCREEN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    iconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    description: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: Spacing.lg,
    },
    bottomSection: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: Spacing.xl,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.primary,
    },
    buttonsRow: {
        gap: Spacing.md,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: Radius.lg,
        gap: Spacing.sm,
    },
    primaryButton: {
        backgroundColor: Colors.dark.primary,
    },
    buttonText: {
        ...Typography.button,
        color: Colors.dark.text,
    },
});
