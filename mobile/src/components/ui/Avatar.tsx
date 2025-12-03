/**
 * Avatar component for user profile images
 */

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Text } from './Text';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  imageUrl?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  imageUrl,
  name = 'U',
  size = 'md',
  style,
}) => {
  const { theme } = useTheme();

  const getSizeValue = (): number => {
    switch (size) {
      case 'sm':
        return 32;
      case 'md':
        return 48;
      case 'lg':
        return 64;
      case 'xl':
        return 96;
    }
  };

  const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  };

  const sizeValue = getSizeValue();
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.container,
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: sizeValue / 2,
          backgroundColor: theme.colors.primary.main,
        },
        style,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
          }}
        />
      ) : (
        <Text
          variant="body"
          style={{
            color: '#FFFFFF',
            fontSize: size === 'sm' ? 14 : size === 'md' ? 18 : size === 'lg' ? 24 : 36,
            fontWeight: theme.typography.fontWeights.semibold,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
