import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layout, tallScreenMinHeight } from '../theme/tokens.ts';
import {
  CARD_STACK_PADDING_TOP,
  cardStackAvailableHeight,
  LATERALITY_BAR_MIN_ROW_WIDTH,
  LATERALITY_CONTROL_HEIGHT,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  LATERALITY_STEP_SIZE,
  lateralityCardGap,
  lateralityChromeReserve,
  MIN_CARD_AREA_HEIGHT,
  STATUS_BAND_HEIGHT,
  STATUS_BAND_LINE_HEIGHT,
  STATUS_SLOT_MIN_WIDTH,
} from './lateralityChrome.ts';
import { WEB_PHONE_MIN_WIDTH } from './webPhoneFrame.ts';

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
  it('uses a status band + label row + 48px rail under the card', () => {
    assert.equal(STATUS_BAND_LINE_HEIGHT, 18);
    assert.equal(STATUS_BAND_HEIGHT, 36);
    assert.equal(LATERALITY_LABEL_ROW_HEIGHT, 20);
    assert.equal(LATERALITY_RAIL_HEIGHT, 48);
    // 36 + 20 + 48 — status band always reserved (AD #119: status never shifts card).
    assert.equal(LATERALITY_CONTROL_HEIGHT, 104);
    assert.equal(LATERALITY_STEP_SIZE, 48);
    assert.ok(LATERALITY_STEP_SIZE >= 44);
    // 390×844 usable height is already ≥ 800 → tall gap.
    assert.equal(lateralityCardGap(PHONE_HEIGHT), layout.cardToControlGapTall);
    assert.equal(lateralityChromeReserve(PHONE_HEIGHT), 104 + 16);
    assert.equal(lateralityCardGap(568), layout.cardToControlGap);
    assert.equal(lateralityChromeReserve(568), 104 + 12);
  });

  it('uses 12 px gap below tall-screen threshold and 16 px at ≥ 800', () => {
    assert.equal(tallScreenMinHeight, 800);
    assert.equal(layout.cardToControlGap, 12);
    assert.equal(layout.cardToControlGapTall, 16);
    assert.equal(lateralityCardGap(799), 12);
    assert.equal(lateralityCardGap(800), 16);
    assert.equal(lateralityCardGap(1200), 16);
    assert.equal(lateralityChromeReserve(799), LATERALITY_CONTROL_HEIGHT + 12);
    assert.equal(lateralityChromeReserve(800), LATERALITY_CONTROL_HEIGHT + 16);
  });

  it('reserves the control + gap under the card instead of a leftover band', () => {
    const usable = PHONE_HEIGHT;
    const available = cardStackAvailableHeight(usable);
    assert.equal(available, usable - lateralityChromeReserve(usable));

    const cardWidth = PHONE_WIDTH - CARD_STACK_PADDING_HORIZONTAL * 2;
    const cardHeight = cardAreaHeight(available, cardWidth);
    const gap = lateralityCardGap(usable);
    const groupHeight = CARD_STACK_PADDING_TOP + cardHeight + gap + LATERALITY_CONTROL_HEIGHT;

    assert.ok(cardHeight >= MIN_CARD_AREA_HEIGHT);
    assert.ok(groupHeight <= usable);
    assert.equal(
      CARD_STACK_PADDING_TOP + cardHeight + lateralityChromeReserve(usable),
      groupHeight,
    );
  });

  it('floors a short viewport at the minimum card height', () => {
    assert.equal(cardStackAvailableHeight(200), MIN_CARD_AREA_HEIGHT);
  });

  it('reserves a measured taller control when the label wraps', () => {
    const wrapped = LATERALITY_CONTROL_HEIGHT + 40;
    assert.equal(lateralityChromeReserve(568, wrapped), wrapped + 12);
    assert.equal(
      cardStackAvailableHeight(844, wrapped),
      844 - lateralityChromeReserve(844, wrapped),
    );
  });

  it('pins the minimum row width to WEB_PHONE_MIN_WIDTH', () => {
    assert.equal(WEB_PHONE_MIN_WIDTH, 320);
    assert.equal(LATERALITY_BAR_MIN_ROW_WIDTH, WEB_PHONE_MIN_WIDTH);
  });

  it('pins a status-slot minimum that word-wraps meta at 200% text', () => {
    // Longest EN/ES status word ≈ 8 glyphs; meta×2 ≈ 26px → ~120px floor.
    assert.equal(STATUS_SLOT_MIN_WIDTH, 120);
    assert.ok(STATUS_SLOT_MIN_WIDTH * 2 + 8 <= LATERALITY_BAR_MIN_ROW_WIDTH);
  });

  it('keeps chrome reserve identical when status fills the reserved band', () => {
    // Empty band (idle) vs filled-to-capacity band — same control height → same card.
    const emptyBandControl =
      STATUS_BAND_HEIGHT + LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;
    const filledBandControl =
      STATUS_BAND_LINE_HEIGHT * 2 + LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;
    assert.equal(emptyBandControl, LATERALITY_CONTROL_HEIGHT);
    assert.equal(filledBandControl, LATERALITY_CONTROL_HEIGHT);
    assert.equal(
      lateralityChromeReserve(844, emptyBandControl),
      lateralityChromeReserve(844, filledBandControl),
    );
    assert.equal(
      cardStackAvailableHeight(844, emptyBandControl),
      cardStackAvailableHeight(844, filledBandControl),
    );

    // Contrast: growing past the band (old squeezed multi-line status) must shrink the card.
    const overflowControl = emptyBandControl + STATUS_BAND_LINE_HEIGHT;
    assert.notEqual(overflowControl, emptyBandControl);
    assert.notEqual(
      cardStackAvailableHeight(844, emptyBandControl),
      cardStackAvailableHeight(844, overflowControl),
    );
  });
});
