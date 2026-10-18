import { useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  CONNECTOR_PULSE_FIRST_DELAY_MS,
  CONNECTOR_PULSE_PEAK_OPACITY,
  pickPulseConnectorId,
  randomPulsePauseMs,
  readConnectorGlowLine,
  type ConnectorGlowLine,
} from '@/lib/connectorPulse';
import { motion } from '@/theme/tokens';
import type { PatternRect, PatternVariantIndex } from '@/lib/patternPlacement';

export type UseConnectorPulseOptions = {
  /** When false, opacity snaps to 0 and timers cancel. */
  allowed: boolean;
  xml: string;
  variant: PatternVariantIndex;
  clearArea: PatternRect;
  conceptKey: string;
  /**
   * Test-only: hold peak opacity on the chosen connector (no timers).
   * Used by `?e2ePulsePeak=1` for Critiquito / Playwright captures.
   */
  forcePeak?: boolean;
};

export type ConnectorPulseState = {
  connectorId: string | null;
  /** Gate is open (or force-peak). E2E asserts this instead of waiting 1500 ms. */
  armed: boolean;
  opacity: SharedValue<number>;
  geometry: ConnectorGlowLine | null;
};

/**
 * Schedules the §11.3 glow on the UI thread: 2400 ms cycle, 7–12 s pause, max one.
 * First breath waits `CONNECTOR_PULSE_FIRST_DELAY_MS` after settle.
 * Does not rewrite the 57 KB pattern XML.
 */
export function useConnectorPulse(options: UseConnectorPulseOptions): ConnectorPulseState {
  const { allowed, xml, variant, clearArea, conceptKey, forcePeak = false } = options;
  const clearKey = `${clearArea.x},${clearArea.y},${clearArea.width},${clearArea.height}`;
  const connectorId = useMemo(
    () =>
      pickPulseConnectorId({
        xml,
        variant,
        clearArea,
        conceptKey,
      }),
    // clearArea is a fresh object each render — key on geometry primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearKey stands in for clearArea
    [xml, variant, clearKey, conceptKey],
  );

  const geometry = useMemo(
    () => (connectorId ? readConnectorGlowLine(xml, connectorId) : null),
    [xml, connectorId],
  );

  const opacity = useSharedValue(0);
  const armed = Boolean((allowed || forcePeak) && connectorId);

  useEffect(() => {
    cancelAnimation(opacity);
    if (forcePeak && connectorId) {
      opacity.value = CONNECTOR_PULSE_PEAK_OPACITY;
      return () => {
        cancelAnimation(opacity);
        opacity.value = 0;
      };
    }
    if (!allowed || !connectorId) {
      opacity.value = 0;
      return () => {
        cancelAnimation(opacity);
        opacity.value = 0;
      };
    }

    const half = motion.glow.cycleMs / 2;
    const pause = randomPulsePauseMs();
    const ease = Easing.inOut(Easing.sin);
    opacity.value = 0;
    opacity.value = withDelay(
      CONNECTOR_PULSE_FIRST_DELAY_MS,
      withRepeat(
        withSequence(
          withTiming(CONNECTOR_PULSE_PEAK_OPACITY, { duration: half, easing: ease }),
          withTiming(0, { duration: half, easing: ease }),
          withDelay(pause, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(opacity);
      opacity.value = 0;
    };
  }, [allowed, connectorId, forcePeak, opacity]);

  return { connectorId, armed, opacity, geometry };
}
