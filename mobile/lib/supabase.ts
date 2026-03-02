import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Environment variables - replaced at build time by Metro bundler from .env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables.\n' +
        'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.'
    );
}

// SSR-safe storage adapter - prevents "window is not defined" error during web SSR
const getStorage = () => {
    // Check if we're in a server-side rendering context
    if (typeof window === 'undefined') {
        // Return a no-op storage for SSR
        return {
            getItem: () => Promise.resolve(null),
            setItem: () => Promise.resolve(),
            removeItem: () => Promise.resolve(),
        };
    }
    // Use localStorage for web, AsyncStorage for native
    if (Platform.OS === 'web') {
        return {
            getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
            setItem: (key: string, value: string) => {
                localStorage.setItem(key, value);
                return Promise.resolve();
            },
            removeItem: (key: string) => {
                localStorage.removeItem(key);
                return Promise.resolve();
            },
        };
    }
    return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: getStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
