import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coachHintSlotHeight } from './coachHintPresentation.ts';
import { layout, tallScreenMinHeight } from '../theme/tokens.ts';
import {
  cardStackAvailableHeight,
  CONTROL_MESSAGING_BAND_HEIGHT,
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
import { resolveCardAspectLayout } from './cardLayout.ts';

/** Phone-frame investigation target from Critiquito Lz-11. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

describe('laterality chrome grouping', () => {
  it('uses a shared messaging band + label row + 48px rail under the card', () => {
    assert.equal(STATUS_BAND_LINE_HEIGHT, 18);
    assert.equal(STATUS_BAND_HEIGHT, 36);
    assert.equal(coachHintSlotHeight(), 56);
    // Tip chip is taller than status — band = max(36, 56) = 56 (never sum).
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, 56);
    assert.equal(LATERALITY_LABEL_ROW_HEIGHT, 20);
    assert.equal(LATERALITY_RAIL_HEIGHT, 48);
    // 56 + 20 + 48 — tip and status share one band (AD #119: never stack).
    assert.equal(LATERALITY_CONTROL_HEIGHT, 124);
    assert.equal(LATERALITY_STEP_SIZE, 48);
    assert.ok(LATERALITY_STEP_SIZE >= 44);
    // 390×844 usable height is already ≥ 800 → tall gap.
    assert.equal(lateralityCardGap(PHONE_HEIGHT), layout.cardToControlGapTall);
    assert.equal(lateralityChromeReserve(PHONE_HEIGHT), 124 + 16);
    assert.equal(lateralityCardGap(568), layout.cardToControlGap);
    assert.equal(lateralityChromeReserve(568), 124 + 12);
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

    const card = resolveCardAspectLayout({
      columnWidth: PHONE_WIDTH,
      availableHeight: available,
    });
    const gap = lateralityCardGap(usable);
    const groupHeight =
      card.topSurplus + card.height + gap + LATERALITY_CONTROL_HEIGHT;

    assert.ok(card.aspect >= 1.3);
    assert.ok(card.aspect <= 1.5);
    assert.ok(groupHeight <= usable);
    assert.equal(
      card.topSurplus + card.height + lateralityChromeReserve(usable),
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

  it('keeps chrome reserve identical for tip, status, or empty messaging band', () => {
    // Empty / tip / status all fit inside CONTROL_MESSAGING_BAND_HEIGHT.
    const emptyBandControl =
      CONTROL_MESSAGING_BAND_HEIGHT + LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;
    const statusFilledControl =
      STATUS_BAND_HEIGHT + LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;
    const tipFilledControl =
      coachHintSlotHeight() + LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;
    assert.equal(emptyBandControl, LATERALITY_CONTROL_HEIGHT);
    assert.equal(tipFilledControl, LATERALITY_CONTROL_HEIGHT);
    // Status content is shorter than the shared band — control height is still the band.
    assert.ok(statusFilledControl < LATERALITY_CONTROL_HEIGHT);
    assert.equal(
      lateralityChromeReserve(844, emptyBandControl),
      lateralityChromeReserve(844, tipFilledControl),
    );
    assert.equal(
      cardStackAvailableHeight(844, emptyBandControl),
      cardStackAvailableHeight(844, tipFilledControl),
    );

    // Contrast: stacking tip + status (old bug) must shrink the card vs shared band.
    const stackedControl =
      STATUS_BAND_HEIGHT +
      coachHintSlotHeight() +
      LATERALITY_LABEL_ROW_HEIGHT +
      LATERALITY_RAIL_HEIGHT;
    assert.notEqual(stackedControl, emptyBandControl);
    assert.notEqual(
      cardStackAvailableHeight(844, emptyBandControl),
      cardStackAvailableHeight(844, stackedControl),
    );
  });
});
