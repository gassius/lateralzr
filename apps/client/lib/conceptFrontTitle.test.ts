import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from '../theme/contrast.ts';
import { color, type } from '../theme/tokens.ts';
import {
  CONCEPT_FRONT_TITLE_COLOR,
  CONCEPT_FRONT_TITLE_FONT_SIZE,
  CONCEPT_FRONT_TITLE_FONT_STACK,
  CONCEPT_FRONT_TITLE_HYPHEN,
  CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO,
  CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
  CONCEPT_FRONT_TITLE_TEXT_ALIGN,
  CONCEPT_FRONT_TITLE_TOP_RATIO,
  TITLE_CLEAR_AREA,
  conceptFrontTitleLayoutWidth,
  conceptFrontTitleRenderedSize,
  hyphenateWord,
  layoutConceptFrontTitle,
  titleColor,
  wrapTitleAtSpaces,
} from './conceptFrontTitle.ts';

/** Deterministic measure: 1px per character × fontSize / 10 (so size matters). */
function measure(text: string, fontSize: number): number {
  return text.length * (fontSize / 10);
}

test('front titles are left-aligned (v3.3; supersedes Lz-04/Lz-14 centre)', () => {
  assert.equal(CONCEPT_FRONT_TITLE_TEXT_ALIGN, 'left');
});

test('default size and line height match type.concept / 1.15', () => {
  assert.equal(CONCEPT_FRONT_TITLE_FONT_SIZE, type.concept);
  assert.equal(CONCEPT_FRONT_TITLE_FONT_SIZE, 32);
  assert.equal(CONCEPT_FRONT_TITLE_MIN_ON_ORANGE, type.conceptMinOnOrange);
  assert.equal(CONCEPT_FRONT_TITLE_MIN_ON_ORANGE, 24);
  assert.ok(CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO >= 1.12);
  assert.ok(CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO <= 1.2);
  assert.equal(CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO, 1.15);
});

test('titleColor uses concept teal at ≥24 and ink below', () => {
  assert.equal(titleColor(32), color.concept);
  assert.equal(titleColor(24), color.concept);
  assert.equal(titleColor(23.9), color.ink);
  assert.equal(titleColor(20), color.ink);
  assert.equal(CONCEPT_FRONT_TITLE_COLOR, color.concept);
  assert.notEqual(CONCEPT_FRONT_TITLE_COLOR, color.ink);
});

test('concept-on-orange meets large-text AA; ink fallback is stronger', () => {
  const conceptOnOrange = contrastRatio(color.concept, color.front);
  const inkOnOrange = contrastRatio(color.ink, color.front);
  assert.ok(conceptOnOrange >= 3);
  assert.ok(conceptOnOrange < 4.5);
  assert.ok(inkOnOrange > conceptOnOrange);
  assert.ok(inkOnOrange >= 4.5);
});

test('rendered size multiplies fontSize by font scale', () => {
  assert.equal(conceptFrontTitleRenderedSize(32, 1), 32);
  assert.equal(conceptFrontTitleRenderedSize(32, 2), 64);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(20, 1)), color.ink);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(20, 1.1)), color.ink);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(20, 1.2)), color.concept);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(24, 1)), color.concept);
});

test('title clear area and top ratio match pattern-master / Critiquito anchor', () => {
  assert.equal(TITLE_CLEAR_AREA.cardWidth, 358);
  assert.equal(TITLE_CLEAR_AREA.cardHeight, 560);
  assert.equal(TITLE_CLEAR_AREA.x, 20);
  assert.equal(TITLE_CLEAR_AREA.y, 236);
  assert.equal(TITLE_CLEAR_AREA.width, 318);
  assert.equal(TITLE_CLEAR_AREA.height, 168);
  assert.ok(CONCEPT_FRONT_TITLE_TOP_RATIO > 0.4);
  assert.ok(CONCEPT_FRONT_TITLE_TOP_RATIO < 0.52);
});

test('wraps at spaces and never mid-word without measuring overflow', () => {
  const wrapped = wrapTitleAtSpaces('Tide Collective', 10 * 3.2, 32, measure);
  assert.equal(wrapped, 'Tide\nCollective');
  assert.equal(wrapTitleAtSpaces('multidisciplinario', 10 * 3.2, 32, measure), null);
});

test('shrinks 32→24 before hyphenating a long Spanish word', () => {
  // "multidisciplinario" = 18 chars. measure: len * size/10.
  // At 32: 57.6; at 24: 43.2 — so width 44 fits only after shrink, no hyphen.
  const fitsAfterShrink = layoutConceptFrontTitle('multidisciplinario', 44, measure);
  assert.equal(fitsAfterShrink.fontSize, 24);
  assert.equal(fitsAfterShrink.displayText, 'multidisciplinario');
  assert.ok(!fitsAfterShrink.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));

  const needsHyphen = layoutConceptFrontTitle('multidisciplinario', 30, measure);
  assert.equal(needsHyphen.fontSize, 24);
  assert.ok(needsHyphen.displayText.includes(`${CONCEPT_FRONT_TITLE_HYPHEN}\n`));
  assert.match(needsHyphen.displayText, /-/);
  // No bare mid-word break: every continued line break must end with a visible hyphen.
  for (const line of needsHyphen.displayText.split('\n').slice(0, -1)) {
    assert.ok(line.endsWith(CONCEPT_FRONT_TITLE_HYPHEN), `expected hyphen on "${line}"`);
  }
});

test('hyphenateWord inserts a visible hyphen before the break', () => {
  const broken = hyphenateWord('multidisciplinario', 20, 24, measure);
  assert.ok(broken.includes(`${CONCEPT_FRONT_TITLE_HYPHEN}\n`));
  assert.equal(broken.includes('multidiscip\nlinario'), false);
});

test('phrase prefers space wraps; long token can hyphenate at 24', () => {
  const phrase = 'marco conceptual multidisciplinario elaborado';
  const layout = layoutConceptFrontTitle(phrase, 36, measure);
  assert.equal(layout.fontSize, 24);
  assert.ok(layout.displayText.includes('marco'));
  assert.ok(layout.displayText.includes('conceptual'));
  // "multidisciplinario" (17*2.4=40.8) overflows 36 → must hyphenate
  assert.ok(layout.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));
});

test('titleColor uses layout fontSize after shrink (ink only below 24)', () => {
  const atFloor = layoutConceptFrontTitle('multidisciplinario', 41, measure);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(atFloor.fontSize, 1)), color.concept);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(23, 1)), color.ink);
});

test('measure font stack matches RN Web System (not bare system-ui)', () => {
  assert.match(CONCEPT_FRONT_TITLE_FONT_STACK, /Segoe UI/);
  assert.match(CONCEPT_FRONT_TITLE_FONT_STACK, /Arial/);
  assert.equal(CONCEPT_FRONT_TITLE_FONT_STACK.includes('system-ui'), false);
});

test('layout width divides content width by OS font scale', () => {
  assert.equal(conceptFrontTitleLayoutWidth(253, 1), 253);
  assert.equal(conceptFrontTitleLayoutWidth(253, 2), 126.5);
  assert.equal(conceptFrontTitleLayoutWidth(100, 0), 100);
});

test('word that fits at 24 is not hyphenated (art-director extraordinariamente case)', () => {
  // Art director: ~231 px at 24 vs ~253 content. Scales linearly with fontSize.
  const fits = (text: string, fontSize: number) => {
    if (text === 'extraordinariamente') return 231 * (fontSize / 24);
    return text.length * fontSize * 0.51;
  };
  // At 32: 308 > 253 → shrink; at 24: 231 ≤ 253 → whole word, no hyphen.
  const layout = layoutConceptFrontTitle('extraordinariamente', 253, fits);
  assert.equal(layout.fontSize, 24);
  assert.equal(layout.displayText, 'extraordinariamente');
  assert.equal(layout.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN), false);
});
