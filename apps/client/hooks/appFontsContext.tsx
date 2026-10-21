import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { createContext, useContext, type ReactNode } from 'react';

import { appFontsReady } from '@/lib/appFonts';

const APP_FONT_SOURCES = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

const AppFontsReadyContext = createContext(false);

/** Load Inter 400/500/600/700 once at the root. Intro/splash stay up until ready. */
export function AppFontsProvider({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(APP_FONT_SOURCES);
  return (
    <AppFontsReadyContext.Provider value={appFontsReady(loaded, error)}>
      {children}
    </AppFontsReadyContext.Provider>
  );
}

export function useAppFontsReady(): boolean {
  return useContext(AppFontsReadyContext);
}
