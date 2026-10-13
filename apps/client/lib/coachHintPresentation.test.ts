import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blendHexOver, contrastRatio } from '../theme/contrast.ts';
import { color } from '../theme/tokens.ts';
import { CONCEPT_FRONT_TITLE_FONT_SIZE } from './conceptFrontTitle.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coachHintContrastRatio,
  coachHintHitSlop,
  coachHintIsSecondaryToConceptTitle,
  coachHintSlotHeight,
  COACH_APPEAR_DURATION_MS,
  COACH_APPEAR_TRANSLATE_Y,
  COACH_HINT_CARD_CLEARANCE_PX,
  COACH_HINT_CHIP_RAIL_ALPHA,
  COACH_HINT_FONT_SIZE,
  COACH_HINT_FONT_WEIGHT,
  COACH_HINT_LINE_HEIGHT,
  COACH_HINT_MIN_TOUCH_TARGET,
  COACH_HINT_OPACITY,
  COACH_HINT_PADDING_H,
  COACH_HINT_PADDING_V,
  COACH_HINT_RADIUS,
  coachHintPalette,
} from './coachHintPresentation.ts';

const coachHintSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/CoachHint.tsx'),
  'utf8',
);

describe('coach hint type hierarchy', () => {
  it('uses 14/500 paper-scale type and stays smaller than the concept title', () => {
    assert.equal(COACH_HINT_FONT_SIZE, 14);
    assert.equal(COACH_HINT_FONT_WEIGHT, '500');
    assert.equal(COACH_HINT_OPACITY, 1);
    assert.ok(coachHintIsSecondaryToConceptTitle());
    assert.ok(COACH_HINT_FONT_SIZE < CONCEPT_FRONT_TITLE_FONT_SIZE);
  });
});

describe('coach hint chip (§12.3 shell)', () => {
  it('tints shell with rail at 10%, radius 12, padding 8×12', () => {
    const shell = coachHintPalette('shell');
    assert.equal(shell.text, color.paper);
    assert.equal(shell.backdrop, color.shell);
    assert.equal(shell.chip, blendHexOver(color.rail, COACH_HINT_CHIP_RAIL_ALPHA, color.shell));
    assert.equal(COACH_HINT_CHIP_RAIL_ALPHA, 0.1);
    assert.equal(COACH_HINT_RADIUS, 12);
    assert.equal(COACH_HINT_PADDING_V, 8);
    assert.equal(COACH_HINT_PADDING_H, 12);
    assert.ok(coachHintContrastRatio('shell') >= 4.5);
  });

  it('keeps legacy orange contrast for helpers that still check it', () => {
    const orange = coachHintPalette('orange');
    assert.equal(orange.text, color.concept);
    assert.equal(orange.chip, color.paper);
    assert.ok(coachHintContrastRatio('orange') >= 4.5);
  });

  it('is a clear upgrade over 12px dark-blue at 75% opacity on orange', () => {
    const washed = blendHexOver(color.concept, 0.75, color.front);
    const legacyRatio = contrastRatio(washed, color.front);
    assert.ok(legacyRatio < 4.5);
    assert.ok(coachHintContrastRatio('orange') > legacyRatio);
  });
});

describe('coach appear motion', () => {
  it('fades in 150ms with no peek/slide translate', () => {
    assert.equal(COACH_APPEAR_DURATION_MS, 150);
    assert.equal(COACH_APPEAR_TRANSLATE_Y, 0);
  });
});

describe('coach tip layout (AD Lz-48)', () => {
  it('reserves a 2-line in-flow band and ≥8px card clearance', () => {
    assert.equal(COACH_HINT_CARD_CLEARANCE_PX, 8);
    assert.equal(
      coachHintSlotHeight(2),
      COACH_HINT_PADDING_V * 2 + COACH_HINT_LINE_HEIGHT * 2,
    );
  });

  it('expands the single-line chip hit area to 48px', () => {
    assert.equal(COACH_HINT_MIN_TOUCH_TARGET, 48);
    const slop = coachHintHitSlop();
    const visual = COACH_HINT_PADDING_V * 2 + COACH_HINT_LINE_HEIGHT;
    assert.ok(visual + slop.top + slop.bottom >= COACH_HINT_MIN_TOUCH_TARGET);
  });

  it('left-aligns tip copy and uses hitSlop on the dismiss control', () => {
    assert.match(coachHintSrc, /textAlign:\s*'left'/);
    assert.match(coachHintSrc, /hitSlop=\{coachHintHitSlop\(\)\}/);
  });
});
