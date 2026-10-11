/**
 * Progressive, session-scoped gesture coaching for the concept deck (§12.3).
 *
 * One tip at a time, fixed order tipTap → tipSwipe → tipComplexity. Laterality
 * is not coached. Copy and chip chrome live in the UI layer.
 */

/** Idle on a settled card before offering the next tip (§12.3). */
export const COACH_IDLE_MS = 4000;

/**
 * @deprecated Prefer {@link COACH_IDLE_MS}. Kept for e2e / older imports.
 * Same 4s idle as the §12.3 sequence.
 */
export const SWIPE_COACH_IDLE_MS = COACH_IDLE_MS;

/** Fixed coaching order. Laterality is intentionally omitted. */
export const COACH_TIP_SEQUENCE = ['tipTap', 'tipSwipe', 'tipComplexity'] as const;

export type CoachTip = (typeof COACH_TIP_SEQUENCE)[number];

/** @deprecated Legacy alias; use {@link CoachTip}. */
export type CoachKind = CoachTip;

/**
 * How far the front card used to peek during swipe coaching.
 * Peek is disabled under §12.3 (tips sit on the shell); constant kept for tests.
 */
export const SWIPE_COACH_PEEK_PX = 36;

/**
 * Flip-peek amount mixed into the card's 0–1 flip progress (legacy).
 * Kept for ConceptCard prop wiring; coaching no longer drives peek.
 */
export const FLIP_COACH_PEEK_AMOUNT = 0.22;

export type DiscoveryCoachingState = {
  tapDiscovered: boolean;
  swipeDiscovered: boolean;
  complexityDiscovered: boolean;
  /** Tip dismissed by tapping the chip (action may still be undiscovered). */
  tipTapDismissed: boolean;
  tipSwipeDismissed: boolean;
  tipComplexityDismissed: boolean;
  /** Tip currently offered after idle. */
  offeredTip: CoachTip | null;
  /**
   * Card index that already received a tip offer this session
   * (at most one tip per card).
   */
  tipCardIndex: number | null;
  /**
   * Card index where Replay re-armed the sequence (Lz-32).
   * Tips only arm on this card and later.
   */
  replayAnchorIndex: number;
};

export type DiscoveryCoachingView = {
  cardIndex: number;
  flipped: boolean;
  deckStatus: boolean;
};

export type DiscoveryCoachingEvent =
  | { type: 'tapped' }
  | { type: 'swipedHorizontal' }
  | { type: 'swipedVertical' }
  | { type: 'offerTip'; tip: CoachTip; cardIndex: number }
  | { type: 'dismissTip' }
  | { type: 'clearOffer' };

export const INITIAL_DISCOVERY_COACHING_STATE: DiscoveryCoachingState = {
  tapDiscovered: false,
  swipeDiscovered: false,
  complexityDiscovered: false,
  tipTapDismissed: false,
  tipSwipeDismissed: false,
  tipComplexityDismissed: false,
  offeredTip: null,
  tipCardIndex: null,
  replayAnchorIndex: 0,
};

let sessionState: DiscoveryCoachingState = { ...INITIAL_DISCOVERY_COACHING_STATE };

export function getDiscoveryCoachingSession(): DiscoveryCoachingState {
  return sessionState;
}

export function setDiscoveryCoachingSession(next: DiscoveryCoachingState): void {
  sessionState = next;
}

/** Fresh coaching state anchored at `anchorIndex` (floored, ≥ 0). */
export function discoveryCoachingStateAfterReplay(anchorIndex: number): DiscoveryCoachingState {
  const anchor =
    Number.isFinite(anchorIndex) && anchorIndex >= 0 ? Math.floor(anchorIndex) : 0;
  return {
    ...INITIAL_DISCOVERY_COACHING_STATE,
    replayAnchorIndex: anchor,
  };
}

/** Reset session coaching; optional anchor is the current card (Replay from mid-deck). */
export function resetDiscoveryCoachingSession(anchorIndex = 0): void {
  sessionState = discoveryCoachingStateAfterReplay(anchorIndex);
}

export function tipResolved(current: DiscoveryCoachingState, tip: CoachTip): boolean {
  switch (tip) {
    case 'tipTap':
      return current.tapDiscovered || current.tipTapDismissed;
    case 'tipSwipe':
      return current.swipeDiscovered || current.tipSwipeDismissed;
    case 'tipComplexity':
      return current.complexityDiscovered || current.tipComplexityDismissed;
    default:
      return true;
  }
}

/** Next unresolved tip in the fixed §12.3 order, or null when the sequence is done. */
export function nextCoachTip(current: DiscoveryCoachingState): CoachTip | null {
  for (const tip of COACH_TIP_SEQUENCE) {
    if (!tipResolved(current, tip)) return tip;
  }
  return null;
}

function withTipDismissed(
  current: DiscoveryCoachingState,
  tip: CoachTip,
): DiscoveryCoachingState {
  switch (tip) {
    case 'tipTap':
      return { ...current, tipTapDismissed: true, offeredTip: null };
    case 'tipSwipe':
      return { ...current, tipSwipeDismissed: true, offeredTip: null };
    case 'tipComplexity':
      return { ...current, tipComplexityDismissed: true, offeredTip: null };
    default:
      return { ...current, offeredTip: null };
  }
}

export function reduceDiscoveryCoaching(
  current: DiscoveryCoachingState,
  event: DiscoveryCoachingEvent,
): DiscoveryCoachingState {
  switch (event.type) {
    case 'tapped':
      if (current.tapDiscovered && current.offeredTip == null) return current;
      return { ...current, tapDiscovered: true, offeredTip: null };
    case 'swipedHorizontal':
      if (current.swipeDiscovered && current.offeredTip == null) return current;
      return { ...current, swipeDiscovered: true, offeredTip: null };
    case 'swipedVertical':
      if (current.complexityDiscovered && current.offeredTip == null) return current;
      return { ...current, complexityDiscovered: true, offeredTip: null };
    case 'offerTip': {
      if (current.offeredTip != null) return current;
      if (tipResolved(current, event.tip)) return current;
      if (nextCoachTip(current) !== event.tip) return current;
      if (current.tipCardIndex === event.cardIndex) return current;
      return {
        ...current,
        offeredTip: event.tip,
        tipCardIndex: event.cardIndex,
      };
    }
    case 'dismissTip':
      if (current.offeredTip == null) return current;
      return withTipDismissed(current, current.offeredTip);
    case 'clearOffer':
      if (current.offeredTip == null) return current;
      return { ...current, offeredTip: null };
    default:
      return current;
  }
}

/**
 * Context ready to start the idle timer for the next tip.
 * Ignores idle time (used to start the timer).
 */
export function coachContextReady(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
): boolean {
  if (currentView.deckStatus || currentView.flipped) return false;
  if (current.offeredTip != null) return false;
  if (currentView.cardIndex < current.replayAnchorIndex) return false;
  if (current.tipCardIndex === currentView.cardIndex) return false;
  return nextCoachTip(current) != null;
}

/** Visible coach tip for this settled card. Null when the UI should stay quiet. */
export function visibleCoach(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
): CoachTip | null {
  if (currentView.deckStatus || currentView.flipped) return null;
  if (current.offeredTip == null) return null;
  if (current.tipCardIndex !== currentView.cardIndex) return null;
  return current.offeredTip;
}

/** Peek animation is off under §12.3 (tips sit on the shell). Always false. */
export function shouldAnimateCoachPeek(_reduceMotion: boolean): boolean {
  return false;
}

export function coachMessageKey(tip: CoachTip): CoachTip {
  return tip;
}

/**
 * Schedule a one-shot coach offer. Returns a cancel function (no-op when not ready).
 * Shared so idle can be unit-tested with a fake clock.
 */
export function scheduleCoachOffer(
  ready: boolean,
  delayMs: number,
  offer: () => void,
  timers: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis,
): () => void {
  if (!ready) return () => {};
  const id = timers.setTimeout(offer, delayMs);
  return () => timers.clearTimeout(id);
}
