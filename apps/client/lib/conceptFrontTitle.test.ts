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

test('measure font stack matches RN Web System (not bare system-ui)', () => {
  assert.match(CONCEPT_FRONT_TITLE_FONT_STACK, /Segoe UI/);
  assert.match(CONCEPT_FRONT_TITLE_FONT_STACK, /Roboto/);
  assert.match(CONCEPT_FRONT_TITLE_FONT_STACK, /Arial/);
  assert.equal(CONCEPT_FRONT_TITLE_FONT_STACK.includes('system-ui'), false);
});

test('wraps at spaces with trailing space before newline (M1)', () => {
  const wrapped = wrapTitleAtSpaces('Tide Collective', 10 * 3.2, 32, measure);
  assert.equal(wrapped, 'Tide \nCollective');
  assert.equal(wrapTitleAtSpaces('multidisciplinario', 10 * 3.2, 32, measure), null);
});

test('B2: short title stays 32; word fitting at 28 gets 28 (size loop)', () => {
  const short = layoutConceptFrontTitle('Tide', 200, measure);
  assert.equal(short.fontSize, 32);
  assert.equal(short.displayText, 'Tide');

  // 10 chars: at 32 → 32px wide, at 28 → 28px. Budget 28.5 forces shrink to 28.
  const mid = layoutConceptFrontTitle('abcdefghij', 28.5, measure);
  assert.equal(mid.fontSize, 28);
  assert.equal(mid.displayText, 'abcdefghij');
  assert.ok(!mid.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));
});

test('shrinks 32→24 before hyphenating a long Spanish word', () => {
  // "multidisciplinario" = 18 chars. At 32: 57.6; at 24: 43.2 — width 44 fits after shrink.
  const fitsAfterShrink = layoutConceptFrontTitle('multidisciplinario', 44, measure);
  assert.equal(fitsAfterShrink.fontSize, 24);
  assert.equal(fitsAfterShrink.displayText, 'multidisciplinario');
  assert.ok(!fitsAfterShrink.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));

  const needsHyphen = layoutConceptFrontTitle('multidisciplinario', 30, measure);
  assert.equal(needsHyphen.fontSize, 24);
  assert.ok(needsHyphen.displayText.includes(`${CONCEPT_FRONT_TITLE_HYPHEN}\n`));
  for (const line of needsHyphen.displayText.split('\n').slice(0, -1)) {
    assert.ok(/[-\s]$/.test(line), `expected hyphen or space before break: "${line}"`);
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
  assert.ok(layout.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));
});

test('word that fits above 24 is not forced to the floor (extraordinariamente)', () => {
  // Art director: ~231 px at 24 vs ~253 content → largest fitting size is 26.
  const fits = (text: string, fontSize: number) => {
    if (text === 'extraordinariamente') return 231 * (fontSize / 24);
    return text.length * fontSize * 0.51;
  };
  const layout = layoutConceptFrontTitle('extraordinariamente', 253, fits);
  assert.equal(layout.fontSize, 26);
  assert.ok(layout.fontSize > CONCEPT_FRONT_TITLE_MIN_ON_ORANGE);
  assert.equal(layout.displayText, 'extraordinariamente');
  assert.equal(layout.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN), false);
});

test('B1: fontScale 2 is passed into measure (shrinks / hyphenates)', () => {
  // 4 chars × size/10. Scale 1: size 32 → 12.8 fits in 20.
  const shortAtScale1 = layoutConceptFrontTitle('abcd', 20, measure, 32, 24, 1);
  assert.equal(shortAtScale1.fontSize, 32);

  // Scale 2: measure(size) uses size×2. Width 19.2 → only size 24 fits (4*4.8=19.2).
  const atScale2 = layoutConceptFrontTitle('abcd', 19.2, measure, 32, 24, 2);
  assert.equal(atScale2.fontSize, 24);
  assert.equal(atScale2.displayText, 'abcd');

  // Tighter width forces hyphen at the 24 floor under fontScale 2.
  const hyphenated = layoutConceptFrontTitle('abcdefghij', 15, measure, 32, 24, 2);
  assert.equal(hyphenated.fontSize, 24);
  assert.ok(hyphenated.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));
});

test('titleColor uses layout fontSize after shrink (ink only below 24)', () => {
  const atFloor = layoutConceptFrontTitle('multidisciplinario', 41, measure);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(atFloor.fontSize, 1)), color.concept);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(23, 1)), color.ink);
});
