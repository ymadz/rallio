/**
 * Theme Context for Rallio mobile app
 * Provides light/dark mode with AsyncStorage persistence
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, ThemeColors } from '@/theme/colors'
import { typography, fontSizes, fontWeights, textStyles } from '@/theme/typography'
import { spacing, borderRadius, iconSizes, heights } from '@/theme/spacing'

const THEME_STORAGE_KEY = 'rallio-theme'

export type ThemeMode = 'light' | 'dark'

export type Theme = {
  mode: ThemeMode
  colors: ThemeColors
  typography: typeof typography
  fontSizes: typeof fontSizes
  fontWeights: typeof fontWeights
  textStyles: typeof textStyles
  spacing: typeof spacing
  borderRadius: typeof borderRadius
  iconSizes: typeof iconSizes
  heights: typeof heights
}

type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>('dark') // Default to dark mode
  const [isLoading, setIsLoading] = useState(true)

  // Load theme from AsyncStorage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setMode(savedTheme)
        }
      } catch (error) {
        console.error('Failed to load theme:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [])

  // Save theme to AsyncStorage when it changes
  const setTheme = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode)
      setMode(newMode)
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }

  const toggleTheme = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark'
    setTheme(newMode)
  }

  const theme: Theme = {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    typography,
    fontSizes,
    fontWeights,
    textStyles,
    spacing,
    borderRadius,
    iconSizes,
    heights,
  }

  // Don't render children until theme is loaded
  if (isLoading) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
