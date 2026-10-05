import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Palette } from '../constants/Colors.ts';
import { contrastRatio, relativeLuminance } from './coachHintPresentation.ts';
import {
  CONCEPT_FRONT_LABEL_COLOR,
  CONCEPT_FRONT_LABEL_FONT_SIZE,
  CONCEPT_FRONT_LABEL_TEXT_ALIGN,
} from './conceptFrontLabelAlign';

test('front titles always center, including Critiquito multiline examples', () => {
  assert.equal(CONCEPT_FRONT_LABEL_TEXT_ALIGN, 'center');
});

test('front title ink matches the logo blackish, not teal chrome', () => {
  assert.equal(CONCEPT_FRONT_LABEL_COLOR, '#231f20');
  assert.equal(CONCEPT_FRONT_LABEL_COLOR, Palette.ink);
  assert.notEqual(CONCEPT_FRONT_LABEL_COLOR, Palette.darkBlue);
});

test('ink on orange is stronger contrast than teal-on-orange and stays near-black', () => {
  const inkOnOrange = contrastRatio(CONCEPT_FRONT_LABEL_COLOR, Palette.orange);
  const tealOnOrange = contrastRatio(Palette.darkBlue, Palette.orange);
  assert.ok(inkOnOrange > tealOnOrange);
  assert.ok(inkOnOrange >= 4.5);
  assert.ok(relativeLuminance(CONCEPT_FRONT_LABEL_COLOR) < 0.05);
  assert.ok(relativeLuminance(CONCEPT_FRONT_LABEL_COLOR) < relativeLuminance(Palette.darkBlue));
});

test('title stays larger than coach copy', () => {
  assert.equal(CONCEPT_FRONT_LABEL_FONT_SIZE, 48);
});
