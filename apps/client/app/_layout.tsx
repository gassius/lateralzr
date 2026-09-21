import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useLayoutEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { WebPhoneFrame } from '@/components/WebPhoneFrame';
import { Palette } from '@/constants/Colors';
import { ensureGtmWebLoaded } from '@/lib/analytics';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Palette.orange,
    background: Palette.darkBlue,
    card: Palette.darkBlue,
    text: Palette.offWhite,
    border: 'rgba(255,255,255,0.12)',
  },
};

export default function RootLayout() {
  useLayoutEffect(() => {
    ensureGtmWebLoaded();
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <WebPhoneFrame>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.darkBlue } }}>
            <Stack.Screen name="index" />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </WebPhoneFrame>
  );
}
