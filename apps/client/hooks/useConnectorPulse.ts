import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyConnectorPulseOpacity,
  CONNECTOR_PULSE_FIRST_DELAY_MS,
  CONNECTOR_PULSE_PEAK_OPACITY,
  pickPulseConnectorId,
  pulseOpacityAt,
  randomPulseCycleMs,
  randomPulsePauseMs,
} from '@/lib/connectorPulse';
import type { PatternRect, PatternVariantIndex } from '@/lib/patternPlacement';

export type UseConnectorPulseOptions = {
  /** When false, opacity snaps to 0 within one frame and timers cancel. */
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
  opacity: number;
  /** XML with the active connector's fill-opacity applied (or original when 0). */
  pulsedXml: string;
};

/**
 * Schedules the §11.3 breath: cycle 2–3 s, pause 8–15 s, max one concurrent.
 * Starts only while `allowed`; stop is immediate (opacity → 0).
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

  const [opacity, setOpacity] = useState(0);
  const opacityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  const clearTimers = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const snapTo = (next: number) => {
    opacityRef.current = next;
    setOpacity(next);
  };

  useEffect(() => {
    generationRef.current += 1;
    const gen = generationRef.current;
    clearTimers();

    if (forcePeak && connectorId) {
      snapTo(CONNECTOR_PULSE_PEAK_OPACITY);
      return () => {
        clearTimers();
      };
    }

    if (!allowed || !connectorId) {
      snapTo(0);
      return () => {
        clearTimers();
      };
    }

    const runBreath = () => {
      if (generationRef.current !== gen) return;
      const cycleMs = randomPulseCycleMs();
      const started = performance.now();

      const tick = (now: number) => {
        if (generationRef.current !== gen) return;
        const t = Math.min(1, (now - started) / cycleMs);
        snapTo(pulseOpacityAt(t));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        snapTo(0);
        const pauseMs = randomPulsePauseMs();
        timeoutRef.current = setTimeout(() => {
          if (generationRef.current !== gen) return;
          runBreath();
        }, pauseMs);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    // First breath shortly after settle (decorative; not a loading cue).
    timeoutRef.current = setTimeout(runBreath, CONNECTOR_PULSE_FIRST_DELAY_MS);

    return () => {
      generationRef.current += 1;
      clearTimers();
      opacityRef.current = 0;
      setOpacity(0);
    };
  }, [allowed, connectorId, forcePeak]);

  const pulsedXml = useMemo(() => {
    if (!connectorId || opacity <= 0) return xml;
    return applyConnectorPulseOpacity(xml, connectorId, opacity);
  }, [xml, connectorId, opacity]);

  return { connectorId, opacity, pulsedXml };
}
