import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Native iOS/Android: identity wrapper plus the SafeAreaProvider the practice
 * screen reads. Metro never loads `WebPhoneFrame.web.tsx` in native builds, so
 * the Vercel phone frame cannot affect mobile layout.
 */
export function WebPhoneFrame({ children }: { children: ReactNode }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

/** Native: no web frame — callers should fall back to `useWindowDimensions()`. */
export function useWebPhoneFrameSize(): { width: number; height: number; framed: boolean } | null {
  return null;
}
