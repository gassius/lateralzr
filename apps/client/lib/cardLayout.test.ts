import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layout, shadow } from '../theme/tokens.ts';
import {
  CARD_FACE_FALLBACK_WIDTH,
  CARD_PADDING_NARROW_MAX_WIDTH,
  CARD_SHADOW,
  cardPadding,
  cardRadius,
} from './cardLayout.ts';

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
