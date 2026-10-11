import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { MotionPreference } from '@/lib/motionStorage';
import {
  initialPrefersReducedMotion,
  readWebPrefersReducedMotion,
  resolveReducedMotion,
} from '@/lib/reducedMotion';

/**
 * Live reduced-motion flag: OS AccessibilityInfo + web matchMedia, gated by
 * optional in-app Motion preference (`appPref` from Lz-46).
 *
 * First paint uses `initialPrefersReducedMotion` (optimistic ON when unknown).
 * OS / web reduce-motion always wins over Full. When `appPref` is omitted
 * (Lz-34 consumers before menu hydration), only OS/web apply.
 *
 * Shared gate for flip, swipe, sheets (Lz-31), pulse, coaching, cues.
 */
export function useReducedMotion(appPref?: MotionPreference): boolean {
  const [os, setOs] = useState(initialPrefersReducedMotion);
  const [web, setWeb] = useState<boolean | null>(() => readWebPrefersReducedMotion());

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setOs(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setOs(enabled);
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setWeb(null);
      return;
    }
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      setWeb(null);
      return;
    }
    const apply = () => setWeb(mql.matches);
    apply();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
    // Safari < 14
    mql.addListener(apply);
    return () => mql.removeListener(apply);
  }, []);

  return resolveReducedMotion({ os, web, appPref });
}
