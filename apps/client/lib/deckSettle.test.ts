import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DECK_SETTLE_MS,
  DECK_SETTLE_REDUCED_MS,
  deckSettleDurationMs,
  deckSettleEnterShiftPx,
  deckSettleTokens,
} from './deckSettle.ts';
import { motion, spacing } from '../theme/tokens.ts';

describe('deckSettle', () => {
  it('pins 260 ms settle / 150 ms RM from motion.*', () => {
    const tokens = deckSettleTokens();
    assert.equal(tokens.settleMs, 260);
    assert.equal(tokens.reducedMotionCrossfadeMs, 150);
    assert.equal(DECK_SETTLE_MS, motion.swipeSettleMs);
    assert.equal(DECK_SETTLE_REDUCED_MS, motion.reducedMotionCrossfadeMs);
    assert.equal(deckSettleDurationMs(false), 260);
    assert.equal(deckSettleDurationMs(true), 150);
  });

  it('uses quiet-swipe enter shift when motion is full', () => {
    assert.equal(deckSettleEnterShiftPx(false, true), spacing[1]);
    assert.equal(deckSettleEnterShiftPx(false, false), -spacing[1]);
    assert.equal(deckSettleEnterShiftPx(true, true), 0);
  });
});
