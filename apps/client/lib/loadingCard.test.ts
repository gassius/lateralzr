import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOADING_CARD_HAIRLINE_ALPHA,
  LOADING_CARD_PATTERN_OPACITY,
  LOADING_CARD_RAIL_ALPHA,
  LOADING_PATTERN_VARIANT,
} from './loadingCard';
import { patternVariantName } from './patternPlacement';

describe('loadingCard (Lz-35)', () => {
  it('locks Critiquito silhouette alphas and variant 03', () => {
    assert.equal(LOADING_PATTERN_VARIANT, 2);
    assert.equal(patternVariantName(LOADING_PATTERN_VARIANT), 'edge-current');
    assert.equal(LOADING_CARD_RAIL_ALPHA, 0.1);
    assert.equal(LOADING_CARD_PATTERN_OPACITY, 0.1);
    assert.equal(LOADING_CARD_HAIRLINE_ALPHA, 0.33);
  });
});
