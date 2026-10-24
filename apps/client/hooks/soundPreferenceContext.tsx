import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_SOUND_PREFERENCES,
  type SoundPreferences,
} from '@/lib/soundStorage';

const SoundPreferenceContext = createContext<SoundPreferences>(DEFAULT_SOUND_PREFERENCES);

/**
 * Provides in-app Sound preferences (Sound 2) so consumers can read master /
 * music / effects without prop-drilling from HomeScreen.
 */
export function SoundPreferenceProvider({
  value,
  children,
}: {
  value: SoundPreferences;
  children: ReactNode;
}) {
  return (
    <SoundPreferenceContext.Provider value={value}>{children}</SoundPreferenceContext.Provider>
  );
}

/** Current in-app Sound preferences (defaults all on outside a provider). */
export function useSoundPreference(): SoundPreferences {
  return useContext(SoundPreferenceContext);
}
