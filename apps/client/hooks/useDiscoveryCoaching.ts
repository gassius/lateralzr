import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  FLIP_COACH_DELAY_MS,
  flipCoachContextReady,
  getDiscoveryCoachingSession,
  reduceDiscoveryCoaching,
  setDiscoveryCoachingSession,
  shouldAnimateCoachPeek,
  SWIPE_COACH_IDLE_MS,
  swipeCoachContextReady,
  visibleCoach,
  type CoachKind,
  type DiscoveryCoachingEvent,
  type DiscoveryCoachingState,
  type DiscoveryCoachingView,
} from '@/lib/discoveryCoaching';

function initialReduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type UseDiscoveryCoachingArgs = {
  cardIndex: number;
  flipped: boolean;
  deckStatus: boolean;
};

function commitEvent(
  event: DiscoveryCoachingEvent,
  setState: (updater: (prev: DiscoveryCoachingState) => DiscoveryCoachingState) => void,
): void {
  setState((prev) => {
    const next = reduceDiscoveryCoaching(prev, event);
    if (next !== prev) setDiscoveryCoachingSession(next);
    return next;
  });
}

/**
 * Session-scoped swipe/flip coaching. Idle timer resets on pan/tap; flip coach
 * is card-count based (third card) and does not reset on pan.
 */
export function useDiscoveryCoaching({
  cardIndex,
  flipped,
  deckStatus,
}: UseDiscoveryCoachingArgs): {
  coach: CoachKind | null;
  peekEnabled: boolean;
  noteInteraction: () => void;
  noteSwiped: () => void;
  noteFlipped: () => void;
} {
  const [state, setState] = useState<DiscoveryCoachingState>(getDiscoveryCoachingSession);
  const [reduceMotion, setReduceMotion] = useState(initialReduceMotion);
  const [idleEpoch, setIdleEpoch] = useState(0);

  const view: DiscoveryCoachingView = useMemo(
    () => ({ cardIndex, flipped, deckStatus }),
    [cardIndex, flipped, deckStatus],
  );

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

  const noteInteraction = useCallback(() => {
    setIdleEpoch((n) => n + 1);
  }, []);

  const noteSwiped = useCallback(() => {
    commitEvent({ type: 'swiped' }, setState);
  }, []);

  const noteFlipped = useCallback(() => {
    commitEvent({ type: 'flipped' }, setState);
  }, []);

  useEffect(() => {
    if (!swipeCoachContextReady(state, view)) return;
    const timer = setTimeout(() => {
      commitEvent({ type: 'offerSwipe' }, setState);
    }, SWIPE_COACH_IDLE_MS);
    return () => clearTimeout(timer);
  }, [state, view, idleEpoch]);

  useEffect(() => {
    if (!flipCoachContextReady(state, view)) return;
    const timer = setTimeout(() => {
      commitEvent({ type: 'offerFlip' }, setState);
    }, FLIP_COACH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, view]);

  const coach = visibleCoach(state, view);
  /** Also gates the coach copy fade/slide; reduced motion is text-only. */
  const peekEnabled = shouldAnimateCoachPeek(reduceMotion);

  return {
    coach,
    peekEnabled,
    noteInteraction,
    noteSwiped,
    noteFlipped,
  };
}
