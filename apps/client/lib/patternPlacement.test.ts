import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  PATTERN_SVG_01_DESCENDING,
  PATTERN_SVG_02_ASCENDING,
  PATTERN_SVG_03_EDGE,
  PATTERN_SVG_BY_VARIANT,
  PATTERN_SVG_FILENAMES,
} from '../assets/images/pattern/patternXml.ts';
import { PATTERN_CARD_FILL, PATTERN_RELIEF, PATTERN_TITLE_CLEAR_MARGIN_PX } from '../theme/pattern.ts';
import { color } from '../theme/tokens.ts';
import {
  buildPatternSvgXml,
  defaultTitleClearForVariant,
  expandRect,
  faceRectToCardUnits,
  hideMotifsInPatternSvg,
  motifBoundingBox,
  motifsIntersectingClearArea,
  patternVariantName,
  resolvePatternClearArea,
  variantFor,
} from './patternPlacement.ts';
import { PATTERN_VARIANT_PLACEMENTS } from './patternVariantPlacements.ts';

const here = dirname(fileURLToPath(import.meta.url));
const patternDir = join(here, '../assets/images/pattern');

const EXPECTED_SHA256 = {
  'lateralzr-pattern-01-descending-current.svg':
    '7046310f0938d30b863671e44ea80192b97f4ad02b3d89f0892354991b7b1276',
  'lateralzr-pattern-02-ascending-current.svg':
    'afa7d92096936da9ca0c7eff5c65501ed9d723c3220826fef24a9439846a552b',
  'lateralzr-pattern-03-edge-current.svg':
    '2f5c34364c3c0002b3ad8de338c80517f10825f638ce96ca3d0a78d59ba938b6',
} as const;

describe('pattern SVG assets (byte-identical to Critiquito v3.3.1)', () => {
  it('ships the three production files with locked checksums', () => {
    for (const name of PATTERN_SVG_FILENAMES) {
      const bytes = readFileSync(join(patternDir, name));
      const digest = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest, EXPECTED_SHA256[name], name);
    }
  });

  it('keeps SvgXml string exports identical to the on-disk SVG files', () => {
    const exported = [
      PATTERN_SVG_01_DESCENDING,
      PATTERN_SVG_02_ASCENDING,
      PATTERN_SVG_03_EDGE,
    ];
    for (let i = 0; i < PATTERN_SVG_FILENAMES.length; i += 1) {
      const disk = readFileSync(join(patternDir, PATTERN_SVG_FILENAMES[i]!), 'utf8');
      assert.equal(exported[i], disk);
      assert.equal(PATTERN_SVG_BY_VARIANT[i], disk);
    }
  });

  it('keeps pattern relief colours out of UI tokens and on the SVG', () => {
    assert.equal(PATTERN_CARD_FILL, color.front);
    assert.equal(PATTERN_RELIEF.shade.fill, '#C9670F');
    assert.equal(PATTERN_RELIEF.highlight.fill, '#FFB867');
    assert.equal(PATTERN_RELIEF.core.fill, '#EC8318');
    assert.match(PATTERN_SVG_01_DESCENDING, /id="relief-shade"[^>]*fill="#C9670F"/);
    assert.doesNotMatch(JSON.stringify(color), /C9670F|FFB867|EC8318/);
  });
});

describe('variantFor', () => {
  it('is deterministic and stable for the same concept key', () => {
    assert.equal(variantFor('Mushroom'), variantFor('mushroom'));
    assert.equal(variantFor('  Tide '), variantFor('tide'));
    assert.equal(variantFor('mushroom'), variantFor('mushroom'));
  });

  it('spreads fixture keys across all three variants', () => {
    // djb2 % 3 — locked so Critiquito e2e screenshots stay on known variants.
    assert.equal(variantFor('long-label'), 0);
    assert.equal(patternVariantName(0), 'descending-current');
    assert.equal(variantFor('tide'), 1);
    assert.equal(patternVariantName(1), 'ascending-current');
    assert.equal(variantFor('mushroom'), 2);
    assert.equal(patternVariantName(2), 'edge-current');
  });

  it('covers all three buckets over a sample of keys', () => {
    const keys = [
      'a',
      'b',
      'c',
      'creativity',
      'diagram',
      'seta',
      'psychedelics',
      'collective intelligence',
      'intergenerational',
      'transparent',
      'loading-deck',
    ];
    const seen = new Set(keys.map((k) => variantFor(k)));
    assert.equal(seen.size, 3);
  });
});

describe('title clearing', () => {
  it('keeps every motif outside the SVG default clear area', () => {
    for (const variant of [0, 1, 2] as const) {
      const clear = defaultTitleClearForVariant(variant);
      assert.deepEqual(clear, PATTERN_VARIANT_PLACEMENTS[variant].titleClear);
      assert.deepEqual(motifsIntersectingClearArea(variant, clear), []);
      for (const motif of PATTERN_VARIANT_PLACEMENTS[variant].motifs) {
        assert.ok(motifBoundingBox(motif).width > 0);
      }
    }
  });

  it('hides motifs that intersect a tall measured title box + 16 px', () => {
    // 4-line / 200% style box that grows past the default clear into upper motifs.
    const tallTitle = { x: 20, y: 180, width: 318, height: 220 };
    const clear = expandRect(tallTitle, PATTERN_TITLE_CLEAR_MARGIN_PX);
    const hidden = motifsIntersectingClearArea(0, clear);
    assert.ok(hidden.length > 0, 'expected at least one motif under a tall title');
    for (const id of hidden) {
      const motif = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === id);
      assert.ok(motif);
      // Sanity: hidden motifs sit near/above the expanded clear.
      assert.ok(motif.cy < clear.y + clear.height);
    }
    // Bottom motifs stay visible.
    assert.equal(hidden.includes('m11'), false);
    assert.equal(hidden.includes('m12'), false);
  });

  it('maps face-pixel title rects through xMidYMid slice into card units', () => {
    const face = { width: 358, height: 560 };
    const title = { x: 44, y: 260, width: 280, height: 40 };
    const inCard = faceRectToCardUnits(title, face.width, face.height);
    assert.ok(Math.abs(inCard.x - 44) < 0.01);
    assert.ok(Math.abs(inCard.y - 260) < 0.01);

    const resolved = resolvePatternClearArea({
      variant: 0,
      titleFaceRect: title,
      faceWidth: face.width,
      faceHeight: face.height,
    });
    assert.ok(Math.abs(resolved.x - (title.x - 16)) < 0.01);
    assert.ok(Math.abs(resolved.y - (title.y - 16)) < 0.01);
  });

  it('does not hide edge motifs for a short ink-hugging title on variant 03', () => {
    // Full-column width would wrongly clear beside "Mushroom" on edge-current.
    const shortInk = { x: 24, y: 280, width: 160, height: 37 };
    const clear = resolvePatternClearArea({
      variant: 2,
      titleFaceRect: shortInk,
      faceWidth: 358,
      faceHeight: 560,
    });
    assert.deepEqual(motifsIntersectingClearArea(2, clear), []);
  });

  it('strips intersecting motifs from the SVG without rewriting path data', () => {
    const { xml, hiddenMotifs, variant } = buildPatternSvgXml({
      conceptKey: 'long-label',
      titleFaceRect: { x: 20, y: 160, width: 318, height: 240 },
      faceWidth: 358,
      faceHeight: 560,
    });
    assert.equal(variant, 0);
    assert.ok(hiddenMotifs.length > 0);
    for (const id of hiddenMotifs) {
      assert.match(xml, new RegExp(`data-motif="${id}"[^>]*display="none"`));
    }
    // Path geometry in defs stays intact (byte-stable motif artwork).
    assert.match(xml, /id="motif-bulb"/);
    assert.match(xml, /id="motif-arm-a"/);
    const untouched = hideMotifsInPatternSvg(PATTERN_SVG_01_DESCENDING, []);
    assert.equal(untouched, PATTERN_SVG_01_DESCENDING);
  });
});
