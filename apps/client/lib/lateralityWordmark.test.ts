import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  RESERVED_LIGHTBULB_PATH_IDS,
  WORDMARK_ASPECT,
  WORDMARK_LETTER_IDS,
  WORDMARK_LETTERS,
  WORDMARK_VIEWBOX,
  wordmarkViewBoxAttr,
} from '../assets/images/lateralzrWordmark.ts';
import {
  LATERALITY_STEP_SIZE,
  LATERALITY_WORDMARK_HEIGHT,
} from './lateralityChrome.ts';

const here = dirname(fileURLToPath(import.meta.url));
const logoSvg = readFileSync(join(here, '../assets/images/lateralzr_logo.svg'), 'utf8');

describe('laterality wordmark matches the logo outlines', () => {
  it('uses the nine Lateralzr letter paths from the logo SVG', () => {
    assert.deepEqual([...WORDMARK_LETTER_IDS], [
      'path179',
      'path180',
      'path181',
      'path182',
      'path183',
      'path184',
      'path185',
      'path186',
      'path187',
    ]);
    assert.equal(WORDMARK_LETTERS.length, 9);
    for (const letter of WORDMARK_LETTERS) {
      assert.match(logoSvg, new RegExp(`id="${letter.id}"`));
      assert.ok(logoSvg.includes(letter.d));
      assert.ok(logoSvg.includes(letter.transform));
    }
  });

  it('does not ship the reserved lightbulb / idea mark on the laterality bar', () => {
    const ids = WORDMARK_LETTERS.map((letter) => letter.id);
    for (const reserved of RESERVED_LIGHTBULB_PATH_IDS) {
      assert.equal(ids.includes(reserved), false);
      assert.match(logoSvg, new RegExp(`id="${reserved}"`));
    }
  });

  it('crops to the word strip instead of the full mark+lightbulb lockup', () => {
    assert.ok(WORDMARK_VIEWBOX.y >= 200);
    assert.ok(WORDMARK_VIEWBOX.height < 60);
    assert.ok(WORDMARK_ASPECT > 5);
    assert.equal(
      wordmarkViewBoxAttr(),
      `${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`,
    );
  });

  it('keeps the bar wordmark larger than the old 20px generic label', () => {
    assert.ok(LATERALITY_WORDMARK_HEIGHT >= 26);
    assert.ok(LATERALITY_STEP_SIZE >= 44);
  });
});
