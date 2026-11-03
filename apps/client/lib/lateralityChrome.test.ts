import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coachHintLinesForGap, coachHintSlotHeight } from './coachHintPresentation.ts';
import { layout } from '../theme/tokens.ts';
import {
  cardStackAvailableHeight,
  COMPLEXITY_CONTROL_HEIGHT,
  complexityDotsBottomToControlBottom,
  CONTROL_MESSAGING_BAND_HEIGHT,
  LABEL_GLYPH_TOP_INSET,
  LATERALITY_BAR_MIN_ROW_WIDTH,
  LATERALITY_CONTROL_HEIGHT,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  LATERALITY_STEP_SIZE,
  lateralityChromeReserve,
  messagingMinGapHeight,
  MIN_CARD_AREA_HEIGHT,
  RAIL_DOT_RADIUS,
  resolveEqualCardGaps,
  STATUS_BAND_HEIGHT,
  STATUS_BAND_LINE_HEIGHT,
  STATUS_SLOT_MIN_WIDTH,
  visibleCardGapAbove,
  visibleCardGapBelow,
} from './lateralityChrome.ts';
import { WEB_PHONE_MIN_WIDTH } from './webPhoneFrame.ts';
import {
  cardVerticalBudget,
  resolveCardAspectLayout,
  resolveNativeCardLayout,
} from './cardLayout.ts';
import { practiceHeaderToComplexityOffset } from './practiceLayout.ts';

/** Phone-frame investigation target from Critiquito Lz-11. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

describe('laterality chrome grouping (v3.5)', () => {
  it('uses label row + 48px rail (messaging lives in the lower card gap)', () => {
    assert.equal(STATUS_BAND_LINE_HEIGHT, 18);
    assert.equal(STATUS_BAND_HEIGHT, 36);
    assert.equal(coachHintSlotHeight(), 56);
    // Tip chip is taller than status — band = max(36, 56) = 56 (never sum).
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, 56);
    assert.equal(LATERALITY_LABEL_ROW_HEIGHT, 20);
    assert.equal(LATERALITY_RAIL_HEIGHT, 48);
    // 20 + 48 — no messaging band inside the control (Lz-67).
    assert.equal(LATERALITY_CONTROL_HEIGHT, 68);
    assert.equal(COMPLEXITY_CONTROL_HEIGHT, LATERALITY_CONTROL_HEIGHT);
    assert.equal(LATERALITY_STEP_SIZE, 48);
    assert.ok(LATERALITY_STEP_SIZE >= 44);
    assert.equal(lateralityChromeReserve(), 68);
    assert.equal(layout.cardGapAtReference, 45);
    assert.equal(layout.cardGaps, 'equal');
    assert.equal(layout.messagingLine, 'lower-card-gap');
  });

  it('splits leftover so visible gaps match (dots bottom ↔ Laterality glyph caps)', () => {
    assert.equal(RAIL_DOT_RADIUS, 4.5);
    assert.equal(LABEL_GLYPH_TOP_INSET, 4.5);
    assert.equal(complexityDotsBottomToControlBottom(), 19.5);
    const equal = resolveEqualCardGaps(90);
    // bias = 19.5 − 4.5 = 15 → 37.5 / 52.5; visible both 57.
    assert.equal(equal.above, 37.5);
    assert.equal(equal.below, 52.5);
    assert.ok(
      Math.abs(visibleCardGapAbove(equal.above) - visibleCardGapBelow(equal.below)) < 1e-9,
    );
    assert.equal(messagingMinGapHeight(), 18 + 16);
    const tight = resolveEqualCardGaps(50);
    assert.equal(tight.above, 17.5);
    assert.equal(tight.below, 32.5);
  });

  it('reserves the control under the card; equal gaps are separate', () => {
    const usable = PHONE_HEIGHT;
    const available = cardStackAvailableHeight(usable);
    assert.equal(available, usable - lateralityChromeReserve());

    const card = resolveCardAspectLayout({
      columnWidth: PHONE_WIDTH,
      availableHeight: available,
      surplusMode: 'equal',
    });

    assert.ok(card.aspect >= 1.3);
    assert.ok(card.aspect <= 1.5);
    assert.ok(
      Math.abs(visibleCardGapAbove(card.topSurplus) - visibleCardGapBelow(card.bottomSurplus)) <
        1e-6,
    );
  });

  it('floors a short viewport at the minimum card height', () => {
    assert.equal(cardStackAvailableHeight(200), MIN_CARD_AREA_HEIGHT);
  });

  it('reserves a measured taller control when the label wraps', () => {
    const wrapped = LATERALITY_CONTROL_HEIGHT + 40;
    assert.equal(lateralityChromeReserve(wrapped), wrapped);
    assert.equal(
      cardStackAvailableHeight(844, wrapped),
      844 - lateralityChromeReserve(wrapped),
    );
  });

  it('pins the minimum row width to WEB_PHONE_MIN_WIDTH', () => {
    assert.equal(WEB_PHONE_MIN_WIDTH, 320);
    assert.equal(LATERALITY_BAR_MIN_ROW_WIDTH, WEB_PHONE_MIN_WIDTH);
  });

  it('pins a status-slot minimum that word-wraps meta at 200% text', () => {
    assert.equal(STATUS_SLOT_MIN_WIDTH, 120);
    assert.ok(STATUS_SLOT_MIN_WIDTH * 2 + 8 <= LATERALITY_BAR_MIN_ROW_WIDTH);
  });

  it('keeps tip/status content height shared so the card frame never jumps', () => {
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, coachHintSlotHeight());
    assert.ok(STATUS_BAND_HEIGHT <= CONTROL_MESSAGING_BAND_HEIGHT);
  });

  it('keeps equal visible ~41 pt gaps on 390×844; tip clamps to fit the lower gap', () => {
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, 56);
    const result = resolveNativeCardLayout({
      columnWidth: 390,
      screenHeight: 844,
      insetTop: 47,
      insetBottom: 34,
      headerToComplexityOffset: practiceHeaderToComplexityOffset(),
      complexityBarHeight: COMPLEXITY_CONTROL_HEIGHT,
      lateralityLabelAndRailHeight: LATERALITY_CONTROL_HEIGHT,
    });
    assert.equal(result.aspect, 1.4);
    assert.equal(result.height, 366 * 1.4);
    const above = visibleCardGapAbove(result.topSurplus);
    const below = visibleCardGapBelow(result.bottomSurplus);
    assert.ok(Math.abs(above - below) < 1.01);
    assert.ok(above > 40 && above < 46);
    assert.ok(below > 40 && below < 46);
    // 2-line tip (56) does not fit ~41 — clamp to 1 line (36).
    assert.equal(coachHintLinesForGap(result.bottomSurplus), 1);
    assert.ok(coachHintSlotHeight(1) <= result.bottomSurplus + 1e-9);
    const budget = cardVerticalBudget({
      screenHeight: 844,
      insetTop: 47,
      insetBottom: 34,
      headerToComplexityOffset: practiceHeaderToComplexityOffset(),
      complexityBarHeight: COMPLEXITY_CONTROL_HEIGHT,
      lateralityLabelAndRailHeight: LATERALITY_CONTROL_HEIGHT,
    });
    assert.equal(result.topSurplus + result.height + result.bottomSurplus, budget);
  });

  it('keeps a non-negative lower gap on a short 320×568 phone', () => {
    const result = resolveNativeCardLayout({
      columnWidth: 320,
      screenHeight: 568,
      insetTop: 20,
      insetBottom: 20,
      headerToComplexityOffset: practiceHeaderToComplexityOffset(),
      complexityBarHeight: COMPLEXITY_CONTROL_HEIGHT,
      lateralityLabelAndRailHeight: LATERALITY_CONTROL_HEIGHT,
    });
    assert.ok(result.bottomSurplus >= 0);
    assert.ok(result.topSurplus >= 0);
  });
});
