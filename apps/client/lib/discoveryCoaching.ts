/**
 * Progressive, session-scoped gesture coaching for the concept deck.
 *
 * Help only until the user has discovered swipe / flip; stay quiet after.
 * Timings follow Critiquito Lz-02 (idle ~4–6s on the first card; flip around
 * the third card). Copy and animation live in the UI layer.
 */

/** Idle on the first card before swipe coaching. Ticket suggests ~4–6s. */
export const SWIPE_COACH_IDLE_MS = 5000;

/** 0-based index of the card where flip coaching may appear (the third card). */
export const FLIP_COACH_CARD_INDEX = 2;

/** Short pause after landing on the third card so the concept can be read first. */
export const FLIP_COACH_DELAY_MS = 800;

/** How far the front card peeks toward the next card during swipe coaching. */
export const SWIPE_COACH_PEEK_PX = 36;

/**
 * Flip-peek amount mixed into the card's 0–1 flip progress (a glimpse, not a flip).
 * Kept well below 0.5 so the back face never becomes the primary view.
 */
export const FLIP_COACH_PEEK_AMOUNT = 0.22;

export type CoachKind = 'swipe' | 'flip';

export type DiscoveryCoachingState = {
  swipeDiscovered: boolean;
  flipDiscovered: boolean;
  /** Offered at most once per session, even if the user ignores it. */
  swipeCoachOffered: boolean;
  flipCoachOffered: boolean;
};

export type DiscoveryCoachingView = {
  cardIndex: number;
  flipped: boolean;
  deckStatus: boolean;
};

export type DiscoveryCoachingEvent =
  | { type: 'swiped' }
  | { type: 'flipped' }
  | { type: 'offerSwipe' }
  | { type: 'offerFlip' };

export const INITIAL_DISCOVERY_COACHING_STATE: DiscoveryCoachingState = {
  swipeDiscovered: false,
  flipDiscovered: false,
  swipeCoachOffered: false,
  flipCoachOffered: false,
};

let sessionState: DiscoveryCoachingState = { ...INITIAL_DISCOVERY_COACHING_STATE };

export function getDiscoveryCoachingSession(): DiscoveryCoachingState {
  return sessionState;
}

export function setDiscoveryCoachingSession(next: DiscoveryCoachingState): void {
  sessionState = next;
}

export function resetDiscoveryCoachingSession(): void {
  sessionState = { ...INITIAL_DISCOVERY_COACHING_STATE };
}

export function reduceDiscoveryCoaching(
  current: DiscoveryCoachingState,
  event: DiscoveryCoachingEvent,
): DiscoveryCoachingState {
  switch (event.type) {
    case 'swiped':
      if (current.swipeDiscovered) return current;
      return { ...current, swipeDiscovered: true };
    case 'flipped':
      if (current.flipDiscovered) return current;
      return { ...current, flipDiscovered: true };
    case 'offerSwipe':
      if (current.swipeDiscovered || current.swipeCoachOffered) return current;
      return { ...current, swipeCoachOffered: true };
    case 'offerFlip':
      if (current.flipDiscovered || current.flipCoachOffered) return current;
      return { ...current, flipCoachOffered: true };
    default:
      return current;
  }
}

/** Context for swipe coaching, ignoring idle time (used to start the idle timer). */
export function swipeCoachContextReady(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
): boolean {
  if (current.swipeDiscovered || current.swipeCoachOffered) return false;
  if (currentView.deckStatus || currentView.flipped) return false;
  return currentView.cardIndex === 0;
}

/** Context for flip coaching, ignoring dwell time (used to start the third-card delay). */
export function flipCoachContextReady(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
): boolean {
  if (current.flipDiscovered || current.flipCoachOffered) return false;
  if (currentView.deckStatus || currentView.flipped) return false;
  return currentView.cardIndex === FLIP_COACH_CARD_INDEX;
}

export function canOfferSwipeCoach(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
  idleMs: number,
): boolean {
  if (!swipeCoachContextReady(current, currentView)) return false;
  return idleMs >= SWIPE_COACH_IDLE_MS;
}

export function canOfferFlipCoach(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
  dwellMs: number,
): boolean {
  if (!flipCoachContextReady(current, currentView)) return false;
  return dwellMs >= FLIP_COACH_DELAY_MS;
}

/** Visible coach for this card. Null after discovery or when the UI should stay quiet. */
export function visibleCoach(
  current: DiscoveryCoachingState,
  currentView: DiscoveryCoachingView,
): CoachKind | null {
  if (currentView.deckStatus || currentView.flipped) return null;
  if (
    !current.swipeDiscovered &&
    current.swipeCoachOffered &&
    currentView.cardIndex === 0
  ) {
    return 'swipe';
  }
  if (
    !current.flipDiscovered &&
    current.flipCoachOffered &&
    currentView.cardIndex === FLIP_COACH_CARD_INDEX
  ) {
    return 'flip';
  }
  return null;
}

export function shouldAnimateCoachPeek(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

export function coachMessageKey(kind: CoachKind): 'swipeCoach' | 'flipCoach' {
  return kind === 'swipe' ? 'swipeCoach' : 'flipCoach';
}
