import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONCEPT_FRONT_LABEL_AVG_GLYPH_EM,
  CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH,
  CONCEPT_FRONT_LABEL_FONT_SIZE,
  conceptFrontLabelTextAlign,
} from './conceptFrontLabelAlign';

const PHONE_CONTENT_WIDTH = 320;
const SMALL_PHONE_CONTENT_WIDTH = 256;

test('short Critiquito examples center on phone-width card fronts', () => {
  assert.equal(conceptFrontLabelTextAlign('Tide', PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('Lighthouse', PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('Tide', SMALL_PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('Lighthouse', SMALL_PHONE_CONTENT_WIDTH), 'center');
});

test('short two-word labels that still fit one line center', () => {
  assert.equal(conceptFrontLabelTextAlign('Red tide', PHONE_CONTENT_WIDTH), 'center');
});

test('wrapping or overflowing labels stay left-aligned', () => {
  assert.equal(
    conceptFrontLabelTextAlign('The persistence of memory', PHONE_CONTENT_WIDTH),
    'left',
  );
  assert.equal(
    conceptFrontLabelTextAlign('Pneumonoultramicroscopicsilicovolcanoconiosis', PHONE_CONTENT_WIDTH),
    'left',
  );
});

test('explicit line breaks count as wrapping even when each line is short', () => {
  assert.equal(conceptFrontLabelTextAlign('Tide\nPool', PHONE_CONTENT_WIDTH), 'left');
});

test('empty titles center so the front stays balanced', () => {
  assert.equal(conceptFrontLabelTextAlign('', PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('   ', PHONE_CONTENT_WIDTH), 'center');
});

test('unmeasured content width uses the phone fallback so short labels do not flash left', () => {
  assert.equal(CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH, 320);
  assert.equal(conceptFrontLabelTextAlign('Tide', 0), 'center');
  assert.equal(conceptFrontLabelTextAlign('Lighthouse', 0), 'center');
  assert.equal(
    conceptFrontLabelTextAlign('The persistence of memory', 0),
    'left',
  );
});

test('the wrap threshold is estimated width vs content box at the front title size', () => {
  const avgGlyph = CONCEPT_FRONT_LABEL_FONT_SIZE * CONCEPT_FRONT_LABEL_AVG_GLYPH_EM;
  const twelve = '123456789012';
  const thirteen = '1234567890123';
  assert.ok(twelve.length * avgGlyph <= PHONE_CONTENT_WIDTH);
  assert.ok(thirteen.length * avgGlyph > PHONE_CONTENT_WIDTH);
  assert.equal(conceptFrontLabelTextAlign(twelve, PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign(thirteen, PHONE_CONTENT_WIDTH), 'left');
});
