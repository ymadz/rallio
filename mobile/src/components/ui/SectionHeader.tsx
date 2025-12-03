/**
 * Section Header component
 * Used for consistent section headers throughout the app
 */

import React from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { Text } from './Text'
import { Icon } from './Icon'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onPress: () => void
  }
  icon?: string
  iconFamily?: 'ionicons' | 'material' | 'feather'
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
  iconFamily = 'ionicons',
}) => {
  const { theme } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon && (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.primary.main + '20' },
            ]}
          >
            <Icon name={icon} family={iconFamily} size="sm" color="accent" />
          </View>
        )}
        <View>
          <Text variant="h5" style={styles.title}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" color="secondary" style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {action && (
        <Pressable onPress={action.onPress} style={styles.actionButton}>
          <Text variant="bodySmall" color="accent" semibold>
            {action.label}
          </Text>
          <Icon name="chevron-forward" size="xs" color="accent" />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    marginBottom: 0,
  },
  subtitle: {
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
})

export default SectionHeader
