import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from '../theme/contrast.ts';
import { color, type } from '../theme/tokens.ts';
import {
  CONCEPT_FRONT_TITLE_BOTTOM_RESERVE,
  CONCEPT_FRONT_TITLE_COLOR,
  CONCEPT_FRONT_TITLE_FONT_SIZE,
  CONCEPT_FRONT_TITLE_FONT_STACK,
  CONCEPT_FRONT_TITLE_HYPHEN,
  CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO,
  CONCEPT_FRONT_TITLE_MAX_LINES,
  CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
  CONCEPT_FRONT_TITLE_TEXT_ALIGN,
  CONCEPT_FRONT_TITLE_TOP_RATIO,
  NATIVE_TITLE_MEASURE_FALLBACK_MS,
  TITLE_CLEAR_AREA,
  applyNativeTitleTextLayoutOnce,
  clearNativeTitleMeasureCache,
  conceptFrontTitleBlockHeight,
  conceptFrontTitleBottomSpacerMinHeight,
  conceptFrontTitleLineCount,
  conceptFrontTitleNativeProbeText,
  conceptFrontTitleOverflowTopSpacerHeight,
  conceptFrontTitleRenderedSize,
  conceptFrontTitleTopSpacerHeight,
  conceptFrontTitleViewportBlockHeight,
  getCachedNativeTitleLayout,
  hyphenateWord,
  layoutConceptFrontTitle,
  measureConceptFrontTitleWidth,
  nativeTitleFallbackLayout,
  nativeTitleMeasureCacheKey,
  resolveNativeFrontTitlePresentation,
  shouldCommitNativeTitleLayoutToView,
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

  // Tighter width forces hyphen at the 24 floor under fontScale 2 (never below 24).
  const hyphenated = layoutConceptFrontTitle('abcdefghij', 15, measure, 32, 24, 2);
  assert.equal(hyphenated.fontSize, 24);
  assert.ok(hyphenated.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));
});

test('titleColor uses layout fontSize after shrink (ink only below 24)', () => {
  const atFloor = layoutConceptFrontTitle('multidisciplinario', 41, measure);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(atFloor.fontSize, 1)), color.concept);
  assert.equal(titleColor(conceptFrontTitleRenderedSize(23, 1)), color.ink);
});

test('§7.3: shrinks when space wrap exceeds max lines (EN long label shape)', () => {
  assert.equal(CONCEPT_FRONT_TITLE_MAX_LINES, 4);
  // Five 8-letter words: at 32 each is 25.6 wide → width 26 yields 5 lines.
  // Width 41: at 24 two words = 40.8 fit → 3 lines (shrink from 32).
  const fiveWords = 'aaaaaaaa bbbbbbbb cccccccc dddddddd eeeeeeee';
  const at32 = wrapTitleAtSpaces(fiveWords, 26, 32, measure);
  assert.ok(at32 != null);
  assert.equal(conceptFrontTitleLineCount(at32!), 5);

  const layout = layoutConceptFrontTitle(fiveWords, 41, measure);
  assert.ok(layout.fontSize < 32);
  assert.ok(conceptFrontTitleLineCount(layout.displayText) <= CONCEPT_FRONT_TITLE_MAX_LINES);
});

test('top spacer shrinks so a tall title block fits in the face', () => {
  const faceH = 400;
  const shortTop = conceptFrontTitleTopSpacerHeight(faceH, 37);
  assert.equal(shortTop, Math.round(faceH * CONCEPT_FRONT_TITLE_TOP_RATIO));

  const tallTitleH = 200;
  const risen = conceptFrontTitleTopSpacerHeight(faceH, tallTitleH);
  assert.ok(risen < shortTop);
  assert.ok(risen + tallTitleH + CONCEPT_FRONT_TITLE_BOTTOM_RESERVE <= faceH);
});

test('bottom spacer collapses when title fills the face (200% scroll guard)', () => {
  const faceH = 340;
  const titleBlockH = 300;
  const top = conceptFrontTitleTopSpacerHeight(faceH, titleBlockH);
  assert.equal(top, 0);
  const bottom = conceptFrontTitleBottomSpacerMinHeight(faceH, titleBlockH, top);
  assert.equal(bottom, faceH - titleBlockH);
  assert.ok(bottom < CONCEPT_FRONT_TITLE_BOTTOM_RESERVE);
  assert.ok(top + titleBlockH + bottom <= faceH);
});

test('320-wide long label at fontScale 2 stays at teal floor (scroll, never <24)', () => {
  // 320 viewport → card ~296 wide, pad 20 → ~256 content (Lz-26 / AD on #91/#95).
  const title =
    'Extraordinarily elaborate multidisciplinary conceptual framework';
  const contentWidth = 256;
  const faceContentH = 340;
  const layout = layoutConceptFrontTitle(
    title,
    contentWidth,
    measureConceptFrontTitleWidth,
    32,
    24,
    2,
  );
  assert.equal(layout.fontSize, CONCEPT_FRONT_TITLE_MIN_ON_ORANGE);
  const blockH = conceptFrontTitleBlockHeight(layout, 2);
  const viewportH = conceptFrontTitleViewportBlockHeight(layout, 2);
  const lines = conceptFrontTitleLineCount(layout.displayText);
  const top =
    lines > CONCEPT_FRONT_TITLE_MAX_LINES
      ? conceptFrontTitleOverflowTopSpacerHeight(faceContentH, viewportH)
      : conceptFrontTitleTopSpacerHeight(faceContentH, blockH);
  const bottom = conceptFrontTitleBottomSpacerMinHeight(faceContentH, blockH, top);
  // Tall 200% block may exceed the face — spacers collapse / pin; face scroll handles overflow.
  assert.ok(top + viewportH <= faceContentH + 0.5);
  assert.ok(bottom <= CONCEPT_FRONT_TITLE_BOTTOM_RESERVE);
  assert.equal(
    titleColor(conceptFrontTitleRenderedSize(layout.fontSize, 2)),
    color.concept,
  );
});

test('AD #95: overflowFallback may exceed 4 lines at 24; viewport stays ≤4', () => {
  // Five 8-letter words at width 26 → 5 lines at every size 32→24 (no shrink helps).
  const fiveWords = 'aaaaaaaa bbbbbbbb cccccccc dddddddd eeeeeeee';
  const at24 = wrapTitleAtSpaces(fiveWords, 26, 24, measure);
  assert.ok(at24 != null);
  assert.ok(conceptFrontTitleLineCount(at24!) >= 5);

  const layout = layoutConceptFrontTitle(fiveWords, 26, measure);
  assert.equal(layout.fontSize, CONCEPT_FRONT_TITLE_MIN_ON_ORANGE);
  assert.ok(conceptFrontTitleLineCount(layout.displayText) >= 5);

  const scale = 2;
  const blockH = conceptFrontTitleBlockHeight(layout, scale);
  const viewportH = conceptFrontTitleViewportBlockHeight(layout, scale);
  const lineH = Math.round(layout.lineHeight * scale);
  assert.equal(viewportH, CONCEPT_FRONT_TITLE_MAX_LINES * lineH);
  assert.ok(viewportH < blockH);

  const faceH = 340;
  const top = conceptFrontTitleOverflowTopSpacerHeight(faceH, viewportH);
  assert.equal(top, faceH - viewportH);
  // Initial viewport: exactly 4 whole lines — no room for a clipped 5th glyph row.
  assert.equal(faceH - top, viewportH);
});

test('native onTextLayout applies once per title+width+scale; no remeasure after size apply', () => {
  clearNativeTitleMeasureCache();
  const title = 'Extraordinarily elaborate framework';
  const maxWidth = 200;
  const words = conceptFrontTitleNativeProbeText(title).split('\n');
  const lines = words.map((word) => ({
    text: word,
    width: word.length * 12,
  }));

  const first = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth,
    lines,
    probeFontSize: 32,
    fontScale: 1,
  });
  assert.equal(first.applied, true);
  assert.ok(first.layout.fontSize <= 32);

  // Simulate another onTextLayout after the chosen size is painted (wider lines).
  const afterSizeApply = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth,
    lines: words.map((word) => ({ text: word, width: word.length * 20 })),
    probeFontSize: 32,
    fontScale: 1,
  });
  assert.equal(afterSizeApply.applied, false);
  assert.deepEqual(afterSizeApply.layout, first.layout);
  assert.deepEqual(getCachedNativeTitleLayout(title, maxWidth, 1), first.layout);
});

test('native presentation stays opacity 0 until measured; first visible frame is final size', () => {
  clearNativeTitleMeasureCache();
  const title = 'Collective intelligence';
  const maxWidth = 240;

  const before = resolveNativeFrontTitlePresentation(title, maxWidth, 1);
  assert.equal(before.opacity, 0);
  assert.equal(before.layout, null);
  assert.equal(before.shouldProbe, true);

  const words = conceptFrontTitleNativeProbeText(title).split('\n');
  const applied = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth,
    lines: words.map((word) => ({ text: word, width: word.length * 14 })),
    probeFontSize: 32,
    fontScale: 1,
  });
  assert.equal(applied.applied, true);

  const visible = resolveNativeFrontTitlePresentation(title, maxWidth, 1);
  assert.equal(visible.opacity, 1);
  assert.equal(visible.shouldProbe, false);
  assert.ok(visible.layout != null);
  assert.deepEqual(visible.layout, applied.layout);
  // First visible frame uses the cached final layout — never a provisional 32 with opacity 1.
  assert.equal(visible.layout!.fontSize, applied.layout.fontSize);
});

test('B1: unscaled probe widths + fontScale 2 (200%) scale once — not double', () => {
  clearNativeTitleMeasureCache();
  // Probe allowFontScaling={false}: widths are at 32 px unscaled.
  const title = 'Extraordinarily';
  const lines = [{ text: 'Extraordinarily', width: 180 }]; // fits at 32 in ~200 box
  const atScale1 = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth: 200,
    lines,
    probeFontSize: 32,
    fontScale: 1,
  });
  assert.equal(atScale1.layout.fontSize, 32);

  clearNativeTitleMeasureCache();
  // Same unscaled probe widths with fontScale 2 (200%): measure sees 2× advance → shrink
  // toward the teal floor (never below 24).
  const atScale2 = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth: 200,
    lines,
    probeFontSize: 32,
    fontScale: 2,
  });
  assert.ok(atScale2.layout.fontSize < 32);
  assert.ok(atScale2.layout.fontSize >= CONCEPT_FRONT_TITLE_MIN_ON_ORANGE);

  // Double-scaling mutant: pretreat widths as already ×2 then pass fontScale 2 → over-shrink/hyphen.
  clearNativeTitleMeasureCache();
  const doubleScaled = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth: 200,
    lines: [{ text: 'Extraordinarily', width: 180 * 2 }],
    probeFontSize: 32,
    fontScale: 2,
  });
  assert.ok(
    doubleScaled.layout.fontSize < atScale2.layout.fontSize ||
      doubleScaled.layout.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN),
    'double-scaled probe would over-shrink vs allowFontScaling={false}',
  );
});

test('B2: fallback layout exists; late measure does not resize once fallback is visible', () => {
  assert.ok(NATIVE_TITLE_MEASURE_FALLBACK_MS <= 100);
  clearNativeTitleMeasureCache();
  const title = 'Tide Collective';
  const maxWidth = 120;
  const fallback = nativeTitleFallbackLayout(title, maxWidth, 1);
  assert.ok(fallback.fontSize <= 32);

  // Fallback on screen → do not commit a late measured layout to the view.
  assert.equal(shouldCommitNativeTitleLayoutToView(true), false);
  assert.equal(shouldCommitNativeTitleLayoutToView(false), true);

  const words = conceptFrontTitleNativeProbeText(title).split('\n');
  const late = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth,
    lines: words.map((word) => ({ text: word, width: word.length * 10 })),
    probeFontSize: 32,
    fontScale: 1,
  });
  assert.equal(late.applied, true);
  // Cache updated for the next card/width, but the visible title keeps `fallback`.
  assert.deepEqual(getCachedNativeTitleLayout(title, maxWidth, 1), late.layout);
  assert.notDeepEqual(late.layout, fallback);
  assert.equal(shouldCommitNativeTitleLayoutToView(true), false);
});

test('M1: cache key includes fontScale; OS text-size change may remeasure', () => {
  clearNativeTitleMeasureCache();
  const title = 'Framework';
  const maxWidth = 180;
  const key1 = nativeTitleMeasureCacheKey(title, maxWidth, 1);
  const key2 = nativeTitleMeasureCacheKey(title, maxWidth, 2);
  assert.notEqual(key1, key2);

  const lines = [{ text: 'Framework', width: 100 }];
  const at1 = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth,
    lines,
    probeFontSize: 32,
    fontScale: 1,
  });
  assert.equal(at1.applied, true);
  assert.ok(getCachedNativeTitleLayout(title, maxWidth, 1) != null);
  // Different OS scale → miss → may apply a new layout (like a width change).
  assert.equal(getCachedNativeTitleLayout(title, maxWidth, 2), null);
  const at2 = applyNativeTitleTextLayoutOnce({
    title,
    maxWidth,
    lines,
    probeFontSize: 32,
    fontScale: 2,
  });
  assert.equal(at2.applied, true);
  // New key allows a different committed size (remeasure + resize).
  assert.ok(at2.layout.fontSize <= at1.layout.fontSize);
});
