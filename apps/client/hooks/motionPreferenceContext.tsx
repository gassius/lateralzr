import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_MOTION_PREFERENCE,
  type MotionPreference,
} from '@/lib/motionStorage';

const MotionPreferenceContext = createContext<MotionPreference>(DEFAULT_MOTION_PREFERENCE);

/**
 * Provides the in-app Motion preference (Lz-46) so every `useReducedMotion()`
 * consumer — flip/swipe, cues, coaching, sheets — honors menu Reduced/Full.
 */
export function MotionPreferenceProvider({
  value,
  children,
}: {
  value: MotionPreference;
  children: ReactNode;
}) {
  return (
    <MotionPreferenceContext.Provider value={value}>{children}</MotionPreferenceContext.Provider>
  );
}

/** Current in-app Motion preference (defaults to System outside a provider). */
export function useMotionPreference(): MotionPreference {
  return useContext(MotionPreferenceContext);
}
