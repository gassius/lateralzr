import assert from 'node:assert/strict';
import { test } from 'node:test';
import { relativeLuminance } from '../theme/contrast.ts';
import { logoNearBlack } from '../theme/logo.ts';
import { color } from '../theme/tokens.ts';
import { contrastRatio } from './coachHintPresentation.ts';
import {
  CONCEPT_FRONT_LABEL_COLOR,
  CONCEPT_FRONT_LABEL_FONT_SIZE,
  CONCEPT_FRONT_LABEL_TEXT_ALIGN,
} from './conceptFrontLabelAlign';

test('front titles always center, including Critiquito multiline examples', () => {
  assert.equal(CONCEPT_FRONT_LABEL_TEXT_ALIGN, 'center');
});

test('front title uses UI ink, not logo near-black or concept teal', () => {
  assert.equal(CONCEPT_FRONT_LABEL_COLOR, color.ink);
  assert.equal(CONCEPT_FRONT_LABEL_COLOR, '#172126');
  assert.notEqual(CONCEPT_FRONT_LABEL_COLOR, logoNearBlack);
  assert.notEqual(CONCEPT_FRONT_LABEL_COLOR, color.concept);
});

test('ink on orange is stronger contrast than concept-on-orange and stays near-black', () => {
  const inkOnOrange = contrastRatio(CONCEPT_FRONT_LABEL_COLOR, color.front);
  const conceptOnOrange = contrastRatio(color.concept, color.front);
  assert.ok(inkOnOrange > conceptOnOrange);
  assert.ok(inkOnOrange >= 4.5);
  assert.ok(relativeLuminance(CONCEPT_FRONT_LABEL_COLOR) < 0.05);
  assert.ok(relativeLuminance(CONCEPT_FRONT_LABEL_COLOR) < relativeLuminance(color.concept));
});

test('title stays larger than coach copy', () => {
  assert.equal(CONCEPT_FRONT_LABEL_FONT_SIZE, 48);
});
