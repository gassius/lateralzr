import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CARD_STACK_PADDING_TOP,
  cardStackAvailableHeight,
  LATERALITY_CARD_GAP,
  LATERALITY_STEP_SIZE,
  LATERALITY_SUBMENU_HEIGHT,
  lateralityChromeReserve,
  MIN_CARD_AREA_HEIGHT,
} from './lateralityChrome.ts';

/** Phone-frame investigation target from Critiquito Lz-11. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const CARD_STACK_PADDING_HORIZONTAL = 12;
const CARD_ASPECT = 1.4;
const CARD_FILL = 0.78;

function cardAreaHeight(availableHeight: number, cardWidth: number): number {
  const desired = cardWidth > 0 ? cardWidth * CARD_ASPECT : 0;
  return Math.max(
    MIN_CARD_AREA_HEIGHT,
    Math.min(availableHeight * CARD_FILL, desired || availableHeight * CARD_FILL),
  );
}

describe('laterality chrome grouping', () => {
  it('keeps a 72px row with 48px targets flush under the card', () => {
    assert.equal(LATERALITY_SUBMENU_HEIGHT, 72);
    assert.equal(LATERALITY_CARD_GAP, 2);
    assert.equal(LATERALITY_STEP_SIZE, 48);
    assert.ok(LATERALITY_STEP_SIZE >= 44);
    assert.ok(LATERALITY_SUBMENU_HEIGHT >= LATERALITY_STEP_SIZE);
    assert.equal(lateralityChromeReserve(), 74);
  });

  it('reserves the row + gap under the card instead of a leftover band', () => {
    const usable = PHONE_HEIGHT;
    const available = cardStackAvailableHeight(usable);
    assert.equal(available, usable - lateralityChromeReserve());

    const cardWidth = PHONE_WIDTH - CARD_STACK_PADDING_HORIZONTAL * 2;
    const cardHeight = cardAreaHeight(available, cardWidth);
    const groupHeight = CARD_STACK_PADDING_TOP + cardHeight + LATERALITY_CARD_GAP + LATERALITY_SUBMENU_HEIGHT;

    assert.ok(cardHeight >= MIN_CARD_AREA_HEIGHT);
    assert.ok(groupHeight <= usable);
    assert.equal(
      CARD_STACK_PADDING_TOP + cardHeight + lateralityChromeReserve(),
      groupHeight,
    );
  });

  it('does not invent a dead band between card and laterality on 390×844', () => {
    const usable = PHONE_HEIGHT;
    const available = cardStackAvailableHeight(usable);
    const cardWidth = PHONE_WIDTH - CARD_STACK_PADDING_HORIZONTAL * 2;
    const cardHeight = cardAreaHeight(available, cardWidth);

    // Legacy layout pinned the row to the bezel after a flex-grown stack.
    const legacyGap =
      available - CARD_STACK_PADDING_TOP - cardHeight;
    assert.ok(legacyGap > 100, 'documents the orphaned teal band this change closes');
    assert.equal(LATERALITY_CARD_GAP, 2);
    assert.ok(LATERALITY_CARD_GAP <= 2);
    assert.ok(legacyGap > LATERALITY_CARD_GAP * 10);
  });

  it('floors a short viewport at the minimum card height', () => {
    assert.equal(cardStackAvailableHeight(200), MIN_CARD_AREA_HEIGHT);
  });
});
