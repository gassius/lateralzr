import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOGO_DOT_COUNT,
  LOGO_ONE_CYCLE_MS,
  LOGO_PULSE_HALF_MS,
  LOGO_PULSE_MS,
  LOGO_STAGGER_MS,
} from './introLogo';

describe('introLogo pulse timing', () => {
  it('keeps stagger + pulse math coherent for LateralzrLogo', () => {
    assert.equal(LOGO_DOT_COUNT, 4);
    assert.equal(LOGO_PULSE_MS, LOGO_PULSE_HALF_MS * 2);
    assert.equal(
      LOGO_ONE_CYCLE_MS,
      LOGO_STAGGER_MS * (LOGO_DOT_COUNT - 1) + LOGO_PULSE_MS,
    );
  });
});
