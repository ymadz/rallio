/**
 * Location store using Zustand
 * Manages user location and permissions
 */

import { create } from 'zustand'
import * as Location from 'expo-location'

type LocationState = {
  latitude: number | null
  longitude: number | null
  hasPermission: boolean | null
  isLoading: boolean
  error: string | null
  requestPermission: () => Promise<boolean>
  getCurrentLocation: () => Promise<void>
  setLocation: (latitude: number, longitude: number) => void
}

export const useLocationStore = create<LocationState>((set) => ({
  latitude: null,
  longitude: null,
  hasPermission: null,
  isLoading: false,
  error: null,

  requestPermission: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      const hasPermission = status === 'granted'
      set({ hasPermission })
      return hasPermission
    } catch (error) {
      console.error('Failed to request location permission:', error)
      set({ hasPermission: false, error: 'Failed to request location permission' })
      return false
    }
  },

  getCurrentLocation: async () => {
    try {
      set({ isLoading: true, error: null })

      const { status } = await Location.getForegroundPermissionsAsync()
      if (status !== 'granted') {
        const granted = await useLocationStore.getState().requestPermission()
        if (!granted) {
          set({ isLoading: false, error: 'Location permission denied' })
          return
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      set({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error('Failed to get current location:', error)
      set({ isLoading: false, error: 'Failed to get current location' })
    }
  },

  setLocation: (latitude, longitude) => set({ latitude, longitude }),
}))
