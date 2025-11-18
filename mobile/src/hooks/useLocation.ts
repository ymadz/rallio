import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          setLocation({
            latitude: null,
            longitude: null,
            error: 'Permission to access location was denied',
            loading: false,
          });
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          error: null,
          loading: false,
        });
      } catch (error) {
        setLocation({
          latitude: null,
          longitude: null,
          error: 'Error getting location',
          loading: false,
        });
      }
    };

    getLocation();
  }, []);

  const refreshLocation = async () => {
    setLocation((prev) => ({ ...prev, loading: true }));
    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        error: null,
        loading: false,
      });
    } catch (error) {
      setLocation((prev) => ({
        ...prev,
        error: 'Error refreshing location',
        loading: false,
      }));
    }
  };

  return { ...location, refreshLocation };
}
