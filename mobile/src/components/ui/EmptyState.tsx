/**
 * Empty state component for lists and screens with no data
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Text } from './Text';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text variant="h3" center style={styles.title}>
        {title}
      </Text>
      {description && (
        <Text variant="body" color="secondary" center style={styles.description}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          variant="primary"
          onPress={onAction}
          style={styles.action}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 24,
  },
  action: {
    minWidth: 200,
  },
});
