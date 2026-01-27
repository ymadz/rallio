import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Environment variables - these are replaced at build time by Metro
// Fallback values from .env for development
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
    || 'https://angddotiqwhhktqdkiyx.supabase.co';

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuZ2Rkb3RpcXdoaGt0cWRraXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzMxNTksImV4cCI6MjA3OTAwOTE1OX0.dKpIkOzctWTg9RKQ69aa1SNat84bCC3GZzE-RoZm1EA';

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
