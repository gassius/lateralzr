import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONCEPT_FRONT_TITLE_HYPHEN } from './conceptFrontTitle';
import {
  layoutSheetTitle,
  SHEET_TITLE_FONT_SIZE,
  SHEET_TITLE_MIN_FONT_SIZE,
} from './sheetTitle';

/** Approx bold advance (same calibration as conceptFrontTitle). */
const measure = (text: string, fontSize: number): number =>
  text.length * fontSize * 0.51;

test('sheet title stays at token size when it fits', () => {
  const layout = layoutSheetTitle('Laterality', 280, measure, 1);
  assert.equal(layout.fontSize, SHEET_TITLE_FONT_SIZE);
  assert.equal(layout.displayText, 'Laterality');
  assert.equal(layout.lineHeight, Math.round(SHEET_TITLE_FONT_SIZE * 1.2));
});

test('ES Lateralidad at 320×200% shrinks onto one line (no bare mid-word break)', () => {
  // Header text column ≈ 320 − 16×2 gutter − 48 close − 8 gap.
  const maxWidth = 232;
  const layout = layoutSheetTitle('Lateralidad', maxWidth, measure, 2);
  assert.ok(
    layout.fontSize < SHEET_TITLE_FONT_SIZE,
    `expected shrink below ${SHEET_TITLE_FONT_SIZE}, got ${layout.fontSize}`,
  );
  assert.ok(layout.fontSize >= SHEET_TITLE_MIN_FONT_SIZE);
  assert.equal(layout.displayText, 'Lateralidad');
  assert.ok(
    measure('Lateralidad', layout.fontSize * 2) <= maxWidth + 0.01,
    `scaled width ${measure('Lateralidad', layout.fontSize * 2)} exceeds ${maxWidth}`,
  );
});

test('pathological narrow width hyphenates with a visible hyphen at the floor', () => {
  const layout = layoutSheetTitle('Lateralidad', 40, measure, 2);
  assert.equal(layout.fontSize, SHEET_TITLE_MIN_FONT_SIZE);
  assert.ok(layout.displayText.includes(CONCEPT_FRONT_TITLE_HYPHEN));
  assert.equal(layout.displayText.replace(/-\n/g, ''), 'Lateralidad');
  for (const line of layout.displayText.split('\n')) {
    assert.notEqual(line, 'd', 'must not leave a lone letter on its own line');
  }
});
