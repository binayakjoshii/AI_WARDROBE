import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
// IMPORT YOUR SPLASH SCREEN HERE (Adjust the path if it's saved somewhere else)
import AuraSplashScreen from '../components/AuraSplashScreen'; 

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the native splash screen from auto-hiding before fonts load.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // NEW STATE: Tracks if your custom animated splash screen is still playing
  const [showAuraSplash, setShowAuraSplash] = useState(true);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Fonts are ready! Hide the native blank screen...
      SplashScreen.hideAsync(); 
    }
  }, [loaded]);

  // 1. If fonts aren't loaded yet, show nothing (native splash is still visible)
  if (!loaded) {
    return null;
  }

  // 2. Fonts are loaded, but the animation hasn't finished yet. Show Aura Studio!
  if (showAuraSplash) {
    return <AuraSplashScreen onFinish={() => setShowAuraSplash(false)} />;
  }

  // 3. Animation finished! Render the actual application.
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Instantly loads your 4 tabs without a header */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}