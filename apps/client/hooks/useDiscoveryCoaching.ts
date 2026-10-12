import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { shouldQueryScreenReaderForNav } from '@/lib/cardActions';
import {
  COACH_IDLE_MS,
  coachContextReady,
  getDiscoveryCoachingSession,
  nextCoachTip,
  reduceDiscoveryCoaching,
  resetDiscoveryCoachingSession,
  scheduleCoachOffer,
  setDiscoveryCoachingSession,
  visibleCoach,
  type CoachTip,
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
 * Session-scoped §12.3 tip sequence (tipTap → tipSwipe → tipComplexity).
 * Idle timer resets on pan/tap; Replay re-arms from the current card.
 * Motion prefers app-wide {@link useReducedMotion} (Lz-46): under reduced
 * motion the tip chip appears instantly (no fade/slide/pulse).
 */
export function useDiscoveryCoaching({
  cardIndex,
  flipped,
  deckStatus,
}: UseDiscoveryCoachingArgs): {
  /** Visual tip when not on the screen-reader path. */
  coach: CoachTip | null;
  /**
   * Fade-in for the tip chip. False under reduced motion (instant show).
   * Peek / slide are never used under §12.3.
   */
  animateAppear: boolean;
  /** True when reduced motion is preferred — callers skip peek. */
  reduceMotion: boolean;
  /** Screen-reader path: next tip key for the card; suppresses visual tip. */
  a11yHint: CoachTip | null;
  screenReaderEnabled: boolean;
  noteInteraction: () => void;
  noteTapped: () => void;
  noteSwipedHorizontal: () => void;
  noteSwipedVertical: () => void;
  dismissTip: () => void;
  /** App menu “Replay gesture tips”: reset session state and re-arm timers. */
  replayGestureTips: () => void;
} {
  const [state, setState] = useState<DiscoveryCoachingState>(getDiscoveryCoachingSession);
  const reduceMotion = useReducedMotion();
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [idleEpoch, setIdleEpoch] = useState(0);

  const view: DiscoveryCoachingView = useMemo(
    () => ({ cardIndex, flipped, deckStatus }),
    [cardIndex, flipped, deckStatus],
  );

  useEffect(() => {
    // RN-web always reports screen reader enabled — same gate as accessible nav (Lz-39).
    if (!shouldQueryScreenReaderForNav(Platform.OS)) {
      setScreenReaderEnabled(false);
      return;
    }
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
      setScreenReaderEnabled(enabled);
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  const noteInteraction = useCallback(() => {
    setIdleEpoch((n) => n + 1);
  }, []);

  const noteTapped = useCallback(() => {
    commitEvent({ type: 'tapped' }, setState);
  }, []);

  const noteSwipedHorizontal = useCallback(() => {
    commitEvent({ type: 'swipedHorizontal' }, setState);
  }, []);

  const noteSwipedVertical = useCallback(() => {
    commitEvent({ type: 'swipedVertical' }, setState);
  }, []);

  const dismissTip = useCallback(() => {
    commitEvent({ type: 'dismissTip' }, setState);
  }, []);

  const replayGestureTips = useCallback(() => {
    resetDiscoveryCoachingSession(cardIndex);
    setState(getDiscoveryCoachingSession());
    setIdleEpoch((n) => n + 1);
  }, [cardIndex]);

  // Leaving a card while a tip is offered clears the visual offer so the
  // sequence can continue on a later card (tip stays unresolved).
  useEffect(() => {
    if (state.offeredTip != null && state.tipCardIndex != null && state.tipCardIndex !== cardIndex) {
      commitEvent({ type: 'clearOffer' }, setState);
    }
  }, [cardIndex, state.offeredTip, state.tipCardIndex]);

  useEffect(() => {
    return scheduleCoachOffer(coachContextReady(state, view), COACH_IDLE_MS, () => {
      setState((prev) => {
        const tip = nextCoachTip(prev);
        if (tip == null) return prev;
        const next = reduceDiscoveryCoaching(prev, {
          type: 'offerTip',
          tip,
          cardIndex: view.cardIndex,
        });
        if (next !== prev) setDiscoveryCoachingSession(next);
        return next;
      });
    });
  }, [state, view, idleEpoch]);

  const offered = visibleCoach(state, view);
  /** Assistive tech: next unresolved tip as a card hint — no visual tip spam. */
  const a11yHint: CoachTip | null = screenReaderEnabled ? nextCoachTip(state) : null;
  const coach = screenReaderEnabled ? null : offered;

  return {
    coach,
    /** Full motion: short fade; reduced motion: instant (no slide / pulse). */
    animateAppear: !reduceMotion,
    reduceMotion,
    a11yHint,
    screenReaderEnabled,
    noteInteraction,
    noteTapped,
    noteSwipedHorizontal,
    noteSwipedVertical,
    dismissTip,
    replayGestureTips,
  };
}
