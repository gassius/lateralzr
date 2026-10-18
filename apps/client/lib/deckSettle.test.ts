import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECK_SETTLE_MS,
  DECK_SETTLE_REDUCED_MS,
  deckEnterLandsSettled,
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

  it('lands settled after underlay-revealed Next/Complexity; loading-replace still fades', () => {
    assert.equal(deckEnterLandsSettled(false, 'forward', 'forward'), true);
    assert.equal(deckEnterLandsSettled(false, 'forward', null), false);
    assert.equal(deckEnterLandsSettled(false, 'backward', 'backward'), false);
    assert.equal(deckEnterLandsSettled(false, 'backwardGesture', null), true);
    assert.equal(deckEnterLandsSettled(true, 'forward', null), true);
    const here = path.dirname(fileURLToPath(import.meta.url));
    const stackSrc = readFileSync(path.join(here, '../components/ConceptCardStack.tsx'), 'utf8');
    assert.match(stackSrc, /deckEnterLandsSettled\(rm, intent, committedNavIntent\)/);
    assert.match(stackSrc, /enterOpacity\.value = 0/);
    assert.match(stackSrc, /enterOpacity\.value = withTiming\(1/);
  });
});
