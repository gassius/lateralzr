import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import {
  coachContextReady,
  coachMessageKey,
  COACH_IDLE_MS,
  COACH_TIP_SEQUENCE,
  INITIAL_DISCOVERY_COACHING_STATE,
  nextCoachTip,
  reduceDiscoveryCoaching,
  resetDiscoveryCoachingSession,
  getDiscoveryCoachingSession,
  scheduleCoachOffer,
  setDiscoveryCoachingSession,
  shouldAnimateCoachPeek,
  SWIPE_COACH_IDLE_MS,
  tipResolved,
  visibleCoach,
  type DiscoveryCoachingState,
  type DiscoveryCoachingView,
} from './discoveryCoaching.ts';

function view(partial: Partial<DiscoveryCoachingView> = {}): DiscoveryCoachingView {
  return {
    cardIndex: 0,
    flipped: false,
    deckStatus: false,
    ...partial,
  };
}

function state(partial: Partial<DiscoveryCoachingState> = {}): DiscoveryCoachingState {
  return { ...INITIAL_DISCOVERY_COACHING_STATE, ...partial };
}

afterEach(() => {
  resetDiscoveryCoachingSession();
});

type TimerHandle = ReturnType<typeof setTimeout>;

function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();

  const timers = {
    setTimeout(fn: () => void, delay?: number) {
      const id = nextId++;
      pending.set(id, { at: now + (delay ?? 0), fn });
      return id as unknown as TimerHandle;
    },
    clearTimeout(id: TimerHandle) {
      pending.delete(id as unknown as number);
    },
  } as Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;

  function advance(ms: number) {
    now += ms;
    const due = [...pending.entries()]
      .filter(([, item]) => item.at <= now)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, item] of due) {
      if (!pending.has(id)) continue;
      pending.delete(id);
      item.fn();
    }
  }

  return { timers, advance };
}

describe('§12.3 tip sequence', () => {
  it('orders tipTap → tipSwipe → tipComplexity and never coaches laterality', () => {
    assert.deepEqual([...COACH_TIP_SEQUENCE], ['tipTap', 'tipSwipe', 'tipComplexity']);
    assert.equal(COACH_IDLE_MS, 4000);
    assert.equal(SWIPE_COACH_IDLE_MS, COACH_IDLE_MS);
    assert.equal(nextCoachTip(state()), 'tipTap');
  });

  it('does not offer before the idle threshold on a settled card', () => {
    assert.equal(coachContextReady(state(), view({ cardIndex: 0 })), true);
    assert.equal(visibleCoach(state(), view()), null);
  });

  it('offers tipTap after idle, then tipSwipe on the next card, then tipComplexity', () => {
    const tapOffered = reduceDiscoveryCoaching(state(), {
      type: 'offerTip',
      tip: 'tipTap',
      cardIndex: 0,
    });
    assert.equal(tapOffered.offeredTip, 'tipTap');
    assert.equal(visibleCoach(tapOffered, view({ cardIndex: 0 })), 'tipTap');
    assert.equal(coachContextReady(tapOffered, view({ cardIndex: 0 })), false);

    const afterTap = reduceDiscoveryCoaching(tapOffered, { type: 'tapped' });
    assert.equal(afterTap.tapDiscovered, true);
    assert.equal(visibleCoach(afterTap, view({ cardIndex: 0 })), null);
    assert.equal(nextCoachTip(afterTap), 'tipSwipe');
    // At most one tip per card — tipSwipe waits for the next card.
    assert.equal(coachContextReady(afterTap, view({ cardIndex: 0 })), false);
    assert.equal(coachContextReady(afterTap, view({ cardIndex: 1 })), true);

    const swipeOffered = reduceDiscoveryCoaching(afterTap, {
      type: 'offerTip',
      tip: 'tipSwipe',
      cardIndex: 1,
    });
    assert.equal(visibleCoach(swipeOffered, view({ cardIndex: 1 })), 'tipSwipe');

    const afterSwipe = reduceDiscoveryCoaching(swipeOffered, { type: 'swipedHorizontal' });
    assert.equal(afterSwipe.swipeDiscovered, true);
    assert.equal(nextCoachTip(afterSwipe), 'tipComplexity');
    assert.equal(coachContextReady(afterSwipe, view({ cardIndex: 2 })), true);

    const complexityOffered = reduceDiscoveryCoaching(afterSwipe, {
      type: 'offerTip',
      tip: 'tipComplexity',
      cardIndex: 2,
    });
    assert.equal(visibleCoach(complexityOffered, view({ cardIndex: 2 })), 'tipComplexity');

    const afterVertical = reduceDiscoveryCoaching(complexityOffered, {
      type: 'swipedVertical',
    });
    assert.equal(afterVertical.complexityDiscovered, true);
    assert.equal(nextCoachTip(afterVertical), null);
    assert.equal(coachContextReady(afterVertical, view({ cardIndex: 3 })), false);
  });

  it('never offers two tips at once and refuses out-of-order offers', () => {
    const offered = reduceDiscoveryCoaching(state(), {
      type: 'offerTip',
      tip: 'tipTap',
      cardIndex: 0,
    });
    const second = reduceDiscoveryCoaching(offered, {
      type: 'offerTip',
      tip: 'tipSwipe',
      cardIndex: 0,
    });
    assert.equal(second.offeredTip, 'tipTap');
    assert.equal(visibleCoach(second, view()), 'tipTap');

    const skipAhead = reduceDiscoveryCoaching(state(), {
      type: 'offerTip',
      tip: 'tipSwipe',
      cardIndex: 0,
    });
    assert.equal(skipAhead.offeredTip, null);
  });

  it('skips tips whose actions were already discovered', () => {
    const afterTap = reduceDiscoveryCoaching(state(), { type: 'tapped' });
    assert.equal(tipResolved(afterTap, 'tipTap'), true);
    assert.equal(nextCoachTip(afterTap), 'tipSwipe');
    assert.equal(coachContextReady(afterTap, view({ cardIndex: 0 })), true);

    const swipeOffered = reduceDiscoveryCoaching(afterTap, {
      type: 'offerTip',
      tip: 'tipSwipe',
      cardIndex: 0,
    });
    assert.equal(visibleCoach(swipeOffered, view()), 'tipSwipe');
  });

  it('dismisses the visible tip on chip tap and does not return that tip', () => {
    const offered = reduceDiscoveryCoaching(state(), {
      type: 'offerTip',
      tip: 'tipTap',
      cardIndex: 0,
    });
    const dismissed = reduceDiscoveryCoaching(offered, { type: 'dismissTip' });
    assert.equal(dismissed.tipTapDismissed, true);
    assert.equal(dismissed.offeredTip, null);
    assert.equal(tipResolved(dismissed, 'tipTap'), true);
    assert.equal(nextCoachTip(dismissed), 'tipSwipe');
    assert.equal(coachContextReady(dismissed, view({ cardIndex: 0 })), false);
    assert.equal(coachContextReady(dismissed, view({ cardIndex: 1 })), true);
  });

  it('hides coaching while flipped or on deck status', () => {
    const offered = reduceDiscoveryCoaching(state(), {
      type: 'offerTip',
      tip: 'tipTap',
      cardIndex: 0,
    });
    assert.equal(visibleCoach(offered, view({ flipped: true })), null);
    assert.equal(visibleCoach(offered, view({ deckStatus: true })), null);
    assert.equal(coachContextReady(state(), view({ flipped: true })), false);
    assert.equal(coachContextReady(state(), view({ deckStatus: true })), false);
  });

  it('clears a stale offer when the card changes without resolving the tip', () => {
    const offered = reduceDiscoveryCoaching(state(), {
      type: 'offerTip',
      tip: 'tipTap',
      cardIndex: 0,
    });
    const cleared = reduceDiscoveryCoaching(offered, { type: 'clearOffer' });
    assert.equal(cleared.offeredTip, null);
    assert.equal(cleared.tipCardIndex, 0);
    assert.equal(tipResolved(cleared, 'tipTap'), false);
    assert.equal(coachContextReady(cleared, view({ cardIndex: 1 })), true);
  });
});

describe('scheduleCoachOffer', () => {
  it('fires idle exactly at COACH_IDLE_MS and not 1 ms before', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    scheduleCoachOffer(
      coachContextReady(state(), view({ cardIndex: 0 })),
      COACH_IDLE_MS,
      () => {
        offers += 1;
      },
      timers,
    );

    advance(COACH_IDLE_MS - 1);
    assert.equal(offers, 0);
    advance(1);
    assert.equal(offers, 1);
  });

  it('resets interaction by cancel + reschedule and fires only after a second full idle', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    const offer = () => {
      offers += 1;
    };
    const ready = coachContextReady(state(), view({ cardIndex: 0 }));

    const cancel = scheduleCoachOffer(ready, COACH_IDLE_MS, offer, timers);
    advance(3000);
    assert.equal(offers, 0);

    cancel();
    scheduleCoachOffer(ready, COACH_IDLE_MS, offer, timers);

    advance(1000);
    assert.equal(offers, 0);
    advance(COACH_IDLE_MS - 1000);
    assert.equal(offers, 1);
  });

  it('schedules nothing when context is not ready', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    const offer = () => {
      offers += 1;
    };
    const alreadyOffered = state({ offeredTip: 'tipTap', tipCardIndex: 0 });
    const sequenceDone = state({
      tapDiscovered: true,
      swipeDiscovered: true,
      complexityDiscovered: true,
    });

    scheduleCoachOffer(
      coachContextReady(state(), view({ flipped: true })),
      COACH_IDLE_MS,
      offer,
      timers,
    );
    scheduleCoachOffer(
      coachContextReady(alreadyOffered, view()),
      COACH_IDLE_MS,
      offer,
      timers,
    );
    scheduleCoachOffer(
      coachContextReady(sequenceDone, view()),
      COACH_IDLE_MS,
      offer,
      timers,
    );

    advance(COACH_IDLE_MS);
    assert.equal(offers, 0);
  });

  it('does not fire late after cancel', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    const cancel = scheduleCoachOffer(
      coachContextReady(state(), view()),
      COACH_IDLE_MS,
      () => {
        offers += 1;
      },
      timers,
    );

    cancel();
    advance(COACH_IDLE_MS + 100);
    assert.equal(offers, 0);
  });
});

describe('shouldAnimateCoachPeek', () => {
  it('never peeks under §12.3 (tips sit on the shell)', () => {
    assert.equal(shouldAnimateCoachPeek(false), false);
    assert.equal(shouldAnimateCoachPeek(true), false);
  });

  it('coaching hook gates tip fade with useReducedMotion (RM → instant)', () => {
    const src = readFileSync(new URL('../hooks/useDiscoveryCoaching.ts', import.meta.url), 'utf8');
    assert.match(src, /useReducedMotion\(\)/);
    assert.match(src, /animateAppear:\s*!reduceMotion/);
  });
});

describe('coachMessageKey', () => {
  it('maps tips to tipTap / tipSwipe / tipComplexity copy keys', () => {
    assert.equal(coachMessageKey('tipTap'), 'tipTap');
    assert.equal(coachMessageKey('tipSwipe'), 'tipSwipe');
    assert.equal(coachMessageKey('tipComplexity'), 'tipComplexity');
  });
});

describe('discovery coaching session + Replay', () => {
  it('persists discovery for the JS session', () => {
    setDiscoveryCoachingSession(reduceDiscoveryCoaching(state(), { type: 'tapped' }));
    assert.equal(getDiscoveryCoachingSession().tapDiscovered, true);
    resetDiscoveryCoachingSession();
    assert.deepEqual(getDiscoveryCoachingSession(), INITIAL_DISCOVERY_COACHING_STATE);
  });

  it('replay reset clears offered + discovered flags and restarts at tip 1', () => {
    setDiscoveryCoachingSession({
      tapDiscovered: true,
      swipeDiscovered: true,
      complexityDiscovered: true,
      tipTapDismissed: true,
      tipSwipeDismissed: true,
      tipComplexityDismissed: true,
      offeredTip: 'tipComplexity',
      tipCardIndex: 4,
      replayAnchorIndex: 0,
    });
    resetDiscoveryCoachingSession();
    assert.deepEqual(getDiscoveryCoachingSession(), INITIAL_DISCOVERY_COACHING_STATE);
    assert.equal(nextCoachTip(getDiscoveryCoachingSession()), 'tipTap');
    assert.equal(
      coachContextReady(getDiscoveryCoachingSession(), view({ cardIndex: 0 })),
      true,
    );
  });

  it('replay at cardIndex 5 arms tipTap at 5 (not earlier cards)', () => {
    resetDiscoveryCoachingSession(5);
    const s = getDiscoveryCoachingSession();
    assert.equal(s.replayAnchorIndex, 5);
    assert.equal(nextCoachTip(s), 'tipTap');
    assert.equal(coachContextReady(s, view({ cardIndex: 5 })), true);
    assert.equal(coachContextReady(s, view({ cardIndex: 0 })), false);
    assert.equal(coachContextReady(s, view({ cardIndex: 4 })), false);

    const offered = reduceDiscoveryCoaching(s, {
      type: 'offerTip',
      tip: 'tipTap',
      cardIndex: 5,
    });
    assert.equal(visibleCoach(offered, view({ cardIndex: 5 })), 'tipTap');
    assert.equal(visibleCoach(offered, view({ cardIndex: 0 })), null);
  });
});
