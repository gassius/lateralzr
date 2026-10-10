import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  FLIP_COACH_DELAY_MS,
  flipCoachContextReady,
  getDiscoveryCoachingSession,
  reduceDiscoveryCoaching,
  scheduleCoachOffer,
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
  const reduceMotion = useReducedMotion();
  const [idleEpoch, setIdleEpoch] = useState(0);

  const view: DiscoveryCoachingView = useMemo(
    () => ({ cardIndex, flipped, deckStatus }),
    [cardIndex, flipped, deckStatus],
  );

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
    return scheduleCoachOffer(swipeCoachContextReady(state, view), SWIPE_COACH_IDLE_MS, () => {
      commitEvent({ type: 'offerSwipe' }, setState);
    });
  }, [state, view, idleEpoch]);

  useEffect(() => {
    return scheduleCoachOffer(flipCoachContextReady(state, view), FLIP_COACH_DELAY_MS, () => {
      commitEvent({ type: 'offerFlip' }, setState);
    });
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
