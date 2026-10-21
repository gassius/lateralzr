import '@/lib/testQueryParams';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationBar } from 'expo-navigation-bar';
import { useEffect, useLayoutEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { WebPhoneFrame } from '@/components/WebPhoneFrame';
import { AppFontsProvider, useAppFontsReady } from '@/hooks/appFontsContext';
import { ensureGtmWebLoaded } from '@/lib/analytics';
import { applyResolvedLocale } from '@/lib/locale';
import { loadStoredLocale } from '@/lib/localeStorage';
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
    let cancelled = false;
    void loadStoredLocale().then((stored) => {
      if (cancelled) return;
      applyResolvedLocale({ storedLocale: stored });
      document.title = t('webTitle');
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

function RootLayoutInner() {
  const fontsReady = useAppFontsReady();

  useLayoutEffect(() => {
    ensureGtmWebLoaded();
  }, []);

  useWebDocumentTitle();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle('light');
    }
  }, []);

  useEffect(() => {
    if (!fontsReady) return;
    void SplashScreen.hideAsync();
  }, [fontsReady]);

  return (
    <WebPhoneFrame>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.shell } }}>
            <Stack.Screen name="index" options={{ title: t('webTitle') }} />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </WebPhoneFrame>
  );
}

export default function RootLayout() {
  return (
    <AppFontsProvider>
      <RootLayoutInner />
    </AppFontsProvider>
  );
}
