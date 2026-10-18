import type { ReactNode } from 'react';

/**
 * Native iOS/Android: identity wrapper. Metro never loads `WebPhoneFrame.web.tsx`
 * in native builds, so the Vercel phone frame cannot affect mobile layout.
 */
export function WebPhoneFrame({ children }: { children: ReactNode }) {
  return children;
}

/** Native: no web frame — callers should fall back to `useWindowDimensions()`. */
export function useWebPhoneFrameSize(): { width: number; height: number; framed: boolean } | null {
  return null;
}
