import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing! Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your local .env file.'
  );
}

// 1. Create a safe storage adapter that ignores Node.js web server environments
const safeStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve(null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

// 2. Initialize Supabase using the safe adapter
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage, // <-- We swapped AsyncStorage for safeStorage here
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Optimize network connection state cycles when the user minimises the app on mobile
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});