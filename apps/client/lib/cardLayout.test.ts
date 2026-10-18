import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cardAspect, layout, shadow } from '../theme/tokens.ts';
import {
  CARD_FACE_FALLBACK_WIDTH,
  CARD_PADDING_NARROW_MAX_WIDTH,
  CARD_SHADOW,
  CARD_STACK_GUTTER,
  cardPadding,
  cardRadius,
  cardVerticalBudget,
  resolveCardAspectLayout,
  resolveNativeCardLayout,
} from './cardLayout.ts';
import {
  CONTROL_MESSAGING_BAND_HEIGHT,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  lateralityCardGap,
} from './lateralityChrome.ts';
import { practiceMenuChromeHeight } from './practiceLayout.ts';

describe('cardLayout radius and padding', () => {
  it('uses the 22 px card radius token', () => {
    assert.equal(cardRadius(), 22);
    assert.equal(cardRadius(), layout.cardRadius);
  });

  it('pads 20 on narrow widths (≤360) and 24 above', () => {
    assert.equal(CARD_PADDING_NARROW_MAX_WIDTH, 360);
    assert.equal(cardPadding(320), 20);
    assert.equal(cardPadding(360), 20);
    assert.equal(cardPadding(375), 24);
    assert.equal(cardPadding(430), 24);
    assert.equal(cardPadding(320), layout.cardPaddingNarrow);
    assert.equal(cardPadding(430), layout.cardPadding);
  });

  it('treats non-finite widths as narrow', () => {
    assert.equal(cardPadding(Number.NaN), layout.cardPaddingNarrow);
    assert.equal(cardPadding(-12), layout.cardPaddingNarrow);
  });

  it('exposes a stable fallback face width before onLayout', () => {
    assert.equal(CARD_FACE_FALLBACK_WIDTH, 341);
  });
});

describe('cardLayout shadow', () => {
  it('reads subdued shadow.card tokens (no dramatic dark cast)', () => {
    assert.equal(CARD_SHADOW.shadowColor, shadow.card.color);
    assert.equal(CARD_SHADOW.shadowOffset.width, shadow.card.offsetWidth);
    assert.equal(CARD_SHADOW.shadowOffset.height, shadow.card.offsetHeight);
    assert.equal(CARD_SHADOW.shadowOpacity, shadow.card.opacity);
    assert.equal(CARD_SHADOW.shadowRadius, shadow.card.radius);
    assert.equal(CARD_SHADOW.elevation, shadow.card.elevation);
    assert.equal(CARD_SHADOW.shadowOpacity, 0.18);
    assert.equal(CARD_SHADOW.shadowRadius, 12);
    assert.equal(CARD_SHADOW.elevation, 4);
    assert.ok(CARD_SHADOW.shadowOpacity < 0.25);
    assert.ok(CARD_SHADOW.elevation < 8);
  });
});

describe('v3.4 native card aspect (§16.2)', () => {
  const PHONE_WIDTH = 390;
  const PHONE_HEIGHT = 844;
  const INSET_TOP = 47;
  const INSET_BOTTOM = 34;
  const THREE_BUTTON_BOTTOM = 48;
  const menu = practiceMenuChromeHeight();
  const messaging = CONTROL_MESSAGING_BAND_HEIGHT;
  const labelAndRail = LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;

  function phoneLayout(overrides: {
    insetBottom?: number;
    lateralityLabelAndRailHeight?: number;
    extraBelowCard?: number;
    screenHeight?: number;
    columnWidth?: number;
  } = {}) {
    const screenHeight = overrides.screenHeight ?? PHONE_HEIGHT;
    const insetBottom = overrides.insetBottom ?? INSET_BOTTOM;
    const usableForGap = screenHeight - INSET_TOP - insetBottom - menu;
    return resolveNativeCardLayout({
      columnWidth: overrides.columnWidth ?? PHONE_WIDTH,
      screenHeight,
      insetTop: INSET_TOP,
      insetBottom,
      menuBandHeight: menu,
      cardGap: lateralityCardGap(usableForGap),
      messagingBandHeight: messaging,
      lateralityLabelAndRailHeight:
        overrides.lateralityLabelAndRailHeight ?? labelAndRail,
      extraBelowCard: overrides.extraBelowCard,
    });
  }

  it('pins the stack gutter at 12 and aspect tokens', () => {
    assert.equal(CARD_STACK_GUTTER, 12);
    assert.equal(cardAspect.preferred, 1.4);
    assert.equal(cardAspect.min, 1.3);
    assert.equal(cardAspect.max, 1.5);
    assert.equal(cardAspect.minCardWidth, 288);
  });

  it('returns a 1.30–1.50 ratio on 390×844 with 47/34 insets, surplus above', () => {
    const result = phoneLayout();
    assert.equal(result.width, PHONE_WIDTH - CARD_STACK_GUTTER * 2);
    assert.equal(result.width, 366);
    assert.ok(result.aspect >= cardAspect.min);
    assert.ok(result.aspect <= cardAspect.max);
    assert.equal(result.aspect, cardAspect.preferred);
    assert.equal(result.height, result.width * cardAspect.preferred);
    assert.equal(result.narrowed, false);
    assert.ok(result.topSurplus > 0);
    assert.equal(result.padding, layout.cardPadding);
    const budget = cardVerticalBudget({
      screenHeight: PHONE_HEIGHT,
      insetTop: INSET_TOP,
      insetBottom: INSET_BOTTOM,
      menuBandHeight: menu,
      cardGap: lateralityCardGap(PHONE_HEIGHT - INSET_TOP - INSET_BOTTOM - menu),
      messagingBandHeight: messaging,
      lateralityLabelAndRailHeight: labelAndRail,
    });
    assert.equal(result.topSurplus + result.height, budget);
  });

  it('keeps the ratio on Android 3-button-nav insets', () => {
    const result = phoneLayout({ insetBottom: THREE_BUTTON_BOTTOM });
    assert.ok(result.aspect >= cardAspect.min);
    assert.ok(result.aspect <= cardAspect.max);
    assert.equal(result.narrowed, false);
    assert.ok(result.width >= cardAspect.minCardWidth);
    assert.ok(result.topSurplus >= 0);
  });

  it('narrows rather than squashing at 200% text without dropping padding early', () => {
    // Available just below 1.30 × 366 so we narrow, but stay above 360 so
    // face padding remains 24. §16.2 drops to 20 only at minCardWidth.
    const available = 472;
    const result = resolveCardAspectLayout({
      columnWidth: PHONE_WIDTH,
      availableHeight: available,
    });
    assert.equal(result.narrowed, true);
    assert.ok(result.width > 360);
    assert.ok(result.width < 366);
    assert.ok(result.aspect >= cardAspect.min - 1e-9);
    assert.ok(result.aspect <= cardAspect.max + 1e-9);
    assert.equal(result.padding, layout.cardPadding);
    assert.equal(result.padding, cardPadding(result.width));
  });

  it('keeps width-based padding when 200% chrome narrows above 288', () => {
    const result = phoneLayout({ lateralityLabelAndRailHeight: 192 });
    assert.equal(result.narrowed, true);
    assert.ok(result.width >= cardAspect.minCardWidth);
    assert.ok(result.width < 366);
    assert.equal(result.padding, cardPadding(result.width));
  });

  it('narrows to ≥ 288 and never squashes when 1.30 × full width does not fit', () => {
    const fullWidth = 366;
    const tooShort = fullWidth * cardAspect.min - 40;
    const result = resolveCardAspectLayout({
      columnWidth: PHONE_WIDTH,
      availableHeight: tooShort,
    });
    assert.equal(result.narrowed, true);
    assert.ok(result.width >= cardAspect.minCardWidth);
    assert.ok(result.width > cardAspect.minCardWidth);
    assert.ok(result.aspect >= cardAspect.min - 1e-9);
    assert.equal(result.padding, cardPadding(result.width));
    assert.ok(result.height / result.width >= cardAspect.min - 1e-9);
  });

  it('keeps min ratio at min width even when available is smaller (never squash)', () => {
    const result = resolveCardAspectLayout({
      columnWidth: PHONE_WIDTH,
      availableHeight: 200,
    });
    assert.equal(result.narrowed, true);
    assert.equal(result.width, cardAspect.minCardWidth);
    assert.ok(result.height + 1e-9 >= result.width * cardAspect.min);
    assert.equal(result.topSurplus, 0);
    assert.ok(200 < result.width * cardAspect.min);
    assert.equal(result.padding, layout.cardPaddingNarrow);
  });
});
