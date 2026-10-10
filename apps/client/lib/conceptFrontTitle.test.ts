import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from '../theme/contrast.ts';
import { color, type } from '../theme/tokens.ts';
import {
  CONCEPT_FRONT_TITLE_COLOR,
  CONCEPT_FRONT_TITLE_FONT_SIZE,
  CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO,
  CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
  CONCEPT_FRONT_TITLE_TEXT_ALIGN,
  CONCEPT_FRONT_TITLE_TOP_RATIO,
  TITLE_CLEAR_AREA,
  conceptFrontTitleRenderedSize,
  titleColor,
} from './conceptFrontTitle.ts';

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
