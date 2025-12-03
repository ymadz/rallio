/**
 * Loading component - centered spinner with optional text
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Text } from './Text';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  text,
  size = 'large',
  fullScreen = false,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? theme.colors.background.primary : 'transparent' },
      ]}
    >
      <ActivityIndicator size={size} color={theme.colors.primary.main} />
      {text && (
        <Text variant="body" color="secondary" style={styles.text}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullScreen: {
    flex: 1,
  },
  text: {
    marginTop: 12,
  },
});
