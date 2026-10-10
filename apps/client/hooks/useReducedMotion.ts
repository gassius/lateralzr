import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { initialPrefersReducedMotion } from '@/lib/reducedMotion';

/**
 * Live OS Reduce Motion flag (iOS / Android AccessibilityInfo, web matchMedia).
 * First paint uses `initialPrefersReducedMotion` (optimistic ON when unknown).
 *
 * Shared gate for flip, swipe, sheets (Lz-31), pulse, coaching, cues.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(initialPrefersReducedMotion);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  return reduceMotion;
}
