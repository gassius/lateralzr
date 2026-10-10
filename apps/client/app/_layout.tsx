import '@/lib/testQueryParams';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useLayoutEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { WebPhoneFrame } from '@/components/WebPhoneFrame';
import { ensureGtmWebLoaded } from '@/lib/analytics';
import { applyResolvedLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
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

function useWebDocumentTitle() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    applyResolvedLocale();
    document.title = t('webTitle');
  }, []);
}

export default function RootLayout() {
  useLayoutEffect(() => {
    ensureGtmWebLoaded();
  }, []);

  useWebDocumentTitle();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <WebPhoneFrame>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.shell } }}>
            <Stack.Screen name="index" options={{ title: t('webTitle') }} />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </WebPhoneFrame>
  );
}
