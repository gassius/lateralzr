import '@/lib/testQueryParams';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useLayoutEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { WebPhoneFrame } from '@/components/WebPhoneFrame';
import { ensureGtmWebLoaded } from '@/lib/analytics';
import { color } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: color.front,
    background: color.shell,
    card: color.shell,
    text: color.paper,
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.shell } }}>
            <Stack.Screen name="index" />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </WebPhoneFrame>
  );
}
