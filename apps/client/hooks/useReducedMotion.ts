import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useMotionPreference } from '@/hooks/motionPreferenceContext';
import type { MotionPreference } from '@/lib/motionStorage';
import {
  initialPrefersReducedMotion,
  readWebPrefersReducedMotion,
  resolveReducedMotion,
} from '@/lib/reducedMotion';

/**
 * Live reduced-motion flag: OS AccessibilityInfo + web matchMedia, gated by
 * the in-app Motion preference (Lz-46 context, or an explicit `appPref` override).
 *
 * First paint uses `initialPrefersReducedMotion` (optimistic ON when unknown).
 * OS / web reduce-motion always wins over Full.
 *
 * Shared gate for flip, swipe, sheets (Lz-31), pulse, coaching, cues.
 */
export function useReducedMotion(appPrefOverride?: MotionPreference): boolean {
  const contextPref = useMotionPreference();
  const appPref = appPrefOverride ?? contextPref;
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
