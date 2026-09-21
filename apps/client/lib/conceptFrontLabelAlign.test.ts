import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONCEPT_FRONT_LABEL_AVG_GLYPH_EM,
  CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH,
  CONCEPT_FRONT_LABEL_FONT_SIZE,
  conceptFrontLabelTextAlign,
  conceptFrontLabelTextAlignFromLineCount,
} from './conceptFrontLabelAlign';

/** Typical letterboxed web preview content box (~301px measured). */
const PHONE_CONTENT_WIDTH = 301;
const WIDE_PHONE_CONTENT_WIDTH = 366;

test('wraps ⇒ left, else center (line count is the source of truth)', () => {
  assert.equal(conceptFrontLabelTextAlignFromLineCount(1), 'center');
  assert.equal(conceptFrontLabelTextAlignFromLineCount(0), 'center');
  assert.equal(conceptFrontLabelTextAlignFromLineCount(2), 'left');
  assert.equal(conceptFrontLabelTextAlignFromLineCount(3), 'left');
});

test('short Critiquito examples center on typical phone-width card fronts', () => {
  assert.equal(conceptFrontLabelTextAlign('Tide', PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('Lighthouse', PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('Tide', WIDE_PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign('Lighthouse', WIDE_PHONE_CONTENT_WIDTH), 'center');
});

test('short two-word labels that still fit one line center', () => {
  assert.equal(conceptFrontLabelTextAlign('Red tide', PHONE_CONTENT_WIDTH), 'center');
});

test('titles that overflow the content box stay left-aligned', () => {
  assert.equal(conceptFrontLabelTextAlign('Shakespeare', PHONE_CONTENT_WIDTH), 'left');
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
  assert.equal(CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH, 301);
  assert.equal(conceptFrontLabelTextAlign('Tide', 0), 'center');
  assert.equal(conceptFrontLabelTextAlign('Lighthouse', 0), 'center');
  assert.equal(conceptFrontLabelTextAlign('Shakespeare', 0), 'left');
});

test('the wrap threshold is estimated width vs content box at the front title size', () => {
  const avgGlyph = CONCEPT_FRONT_LABEL_FONT_SIZE * CONCEPT_FRONT_LABEL_AVG_GLYPH_EM;
  const ten = '1234567890';
  const twelve = '123456789012';
  assert.ok(ten.length * avgGlyph <= PHONE_CONTENT_WIDTH);
  assert.ok(twelve.length * avgGlyph > PHONE_CONTENT_WIDTH);
  assert.equal(conceptFrontLabelTextAlign(ten, PHONE_CONTENT_WIDTH), 'center');
  assert.equal(conceptFrontLabelTextAlign(twelve, PHONE_CONTENT_WIDTH), 'left');
});
